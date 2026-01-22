#!/usr/bin/env bun
/**
 * ============================================================================
 * SDP TRIAGE SYNC - Maintains local cache of AI-triaged tickets
 * ============================================================================
 *
 * PURPOSE:
 * Keeps a persistent cache of SDP tickets with AI triage results.
 * Designed to run every 5 minutes via cron for always-current data.
 *
 * USAGE:
 *   bun Sync.ts              # Sync tickets and update cache
 *   bun Sync.ts --status     # Show cache status
 *   bun Sync.ts --force      # Force re-triage all tickets
 *   bun Sync.ts --json       # Output current cache as JSON
 *
 * CACHE LOCATION: ~/.cache/sdp-triage/triage-cache.json
 *
 * ============================================================================
 */

import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Cache location
const CACHE_DIR = join(homedir(), ".cache", "sdp-triage");
const CACHE_FILE = join(CACHE_DIR, "triage-cache.json");

interface TicketRaw {
  id: string;
  subject: string;
  status: string;
  priority: string | null;
  due_by_time: string | null;
  created_time: string;
  last_updated_time: string | null;
  requester: {
    name: string;
    email: string;
    is_vip: boolean;
    department: string;
  } | null;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  priority: string;
  due_by_time: string | null;
  created_time: string;
  last_updated_time: string | null;
  requester: {
    name: string;
    email: string;
    is_vip: boolean;
    department: string;
  } | null;
  description?: string;
}

interface TriageResult {
  tier: "P0" | "P1" | "P2" | "P3";
  quick_win: boolean;
  quick_win_reason?: string;
  reasoning: string;
  suggested_action: string;
  estimated_time: string;
}

interface CachedTicket {
  ticket: TicketDetail;
  triage: TriageResult;
  metrics: {
    days_open: number;
    hours_awaiting_response: number | null;
    is_overdue: boolean;
    days_overdue: number;
  };
  cached_at: string;
  last_synced: string;
}

interface TriageCache {
  version: number;
  last_sync: string;
  last_full_triage: string;
  tickets: Record<string, CachedTicket>;
  stats: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    quick_wins: number;
  };
}

// ANSI colors
const c = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(msg: string) {
  console.log(msg);
}

function error(msg: string) {
  console.error(`${c.red}Error: ${msg}${c.reset}`);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load existing cache or create empty one
 */
function loadCache(): TriageCache {
  ensureCacheDir();

  if (existsSync(CACHE_FILE)) {
    try {
      const data = readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(data);
    } catch {
      log(`${c.yellow}Cache corrupted, creating new${c.reset}`);
    }
  }

  return {
    version: 1,
    last_sync: "",
    last_full_triage: "",
    tickets: {},
    stats: { total: 0, p0: 0, p1: 0, p2: 0, p3: 0, quick_wins: 0 },
  };
}

/**
 * Save cache to disk
 */
function saveCache(cache: TriageCache) {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Fetch ticket list from SDP via auth-keeper
 */
async function fetchTicketList(): Promise<TicketRaw[]> {
  const result = spawnSync("bash", [
    "-c",
    "ZONE=work source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && auth-keeper sdp --json",
  ], {
    encoding: "utf-8",
    timeout: 60000,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to fetch tickets: ${result.stderr}`);
  }

  const output = result.stdout.trim();
  if (!output || output === "[]") {
    return [];
  }

  return JSON.parse(output);
}

// Cached token for reuse within session
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get SDP access token (cached within session)
 */
async function getSdpToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && tokenExpiry > now + 300000) {
    return cachedToken;
  }

  // Fetch new token via auth-keeper
  const result = spawnSync("bash", [
    "-c",
    `source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && _ak_sdp_ensure_token && echo "$_ak_sdp_token"`,
  ], {
    encoding: "utf-8",
    timeout: 30000,
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Failed to get SDP token: ${result.stderr}`);
  }

  cachedToken = result.stdout.trim();
  tokenExpiry = now + 3600000; // Assume 1 hour validity
  return cachedToken;
}

/**
 * Fetch single ticket details to get priority (uses cached token)
 */
async function fetchTicketDetail(ticketId: string): Promise<TicketDetail | null> {
  try {
    const token = await getSdpToken();

    const response = await fetch(
      `https://sdpondemand.manageengine.com/api/v3/requests/${ticketId}`,
      {
        headers: {
          "Authorization": `Zoho-oauthtoken ${token}`,
          "Accept": "application/vnd.manageengine.v3+json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { request?: Record<string, unknown> };
    const req = data.request;
    if (!req) return null;

    return {
      id: (req.id as string)?.toString() || ticketId,
      subject: (req.subject as string) || "",
      status: (req.status as { name: string })?.name || "Unknown",
      priority: (req.priority as { name: string })?.name || "Normal",
      due_by_time: (req.due_by_time as { value: string })?.value || null,
      created_time: (req.created_time as { value: string })?.value || Date.now().toString(),
      last_updated_time: (req.last_updated_time as { value: string })?.value || null,
      requester: req.requester ? {
        name: (req.requester as { name: string }).name || "Unknown",
        email: (req.requester as { email_id: string }).email_id || "",
        is_vip: (req.requester as { is_vip_user: boolean }).is_vip_user || false,
        department: (req.requester as { department: { name: string } }).department?.name || "Unknown",
      } : null,
      description: (req.description as string) || "",
    };
  } catch {
    return null;
  }
}

/**
 * Calculate metrics for a ticket
 */
function calculateMetrics(ticket: TicketDetail) {
  const now = Date.now();
  const createdTime = parseInt(ticket.created_time, 10) || now;
  const dueTime = ticket.due_by_time ? parseInt(ticket.due_by_time, 10) : null;
  const lastUpdated = ticket.last_updated_time
    ? parseInt(ticket.last_updated_time, 10)
    : createdTime;

  const daysOpen = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
  const isOverdue = dueTime ? now > dueTime : false;
  const daysOverdue = isOverdue
    ? Math.floor((now - dueTime!) / (1000 * 60 * 60 * 24))
    : 0;
  const hoursSinceUpdate = Math.floor((now - lastUpdated) / (1000 * 60 * 60));

  return {
    days_open: daysOpen,
    hours_awaiting_response: hoursSinceUpdate > 24 ? hoursSinceUpdate : null,
    is_overdue: isOverdue,
    days_overdue: daysOverdue,
  };
}

/**
 * Run AI triage on a batch of tickets
 */
async function runAiTriage(tickets: Array<{ ticket: TicketDetail; metrics: ReturnType<typeof calculateMetrics> }>): Promise<Map<string, TriageResult>> {
  if (tickets.length === 0) {
    return new Map();
  }

  const systemPrompt = `You are an IT helpdesk triage specialist. Analyze these ServiceDesk Plus tickets and categorize each by:
1. Priority tier (P0-P3)
2. Quick Win potential (separate from priority)

Priority Tiers:
- P0 Critical: Requires immediate attention. Overdue + VIP, or 48+ hours awaiting response, or business-critical impact.
- P1 High: Handle today. Overdue, or VIP requester, or 24+ hours awaiting response, or high priority.
- P2 Medium: Handle this week. Due soon, aging tickets, medium priority.
- P3 Low: Handle when able. On track, low priority, no urgency signals.

Quick Win Indicators (can be any priority tier):
- Simple requests: password resets, access grants, info requests
- Known solutions: common issues with documented fixes
- Low complexity: single action resolves it
- Fast turnaround: can close in under 15 minutes
- Clear path: obvious next step, no investigation needed

Output ONLY a JSON array (no markdown, no explanation) with objects:
{
  "ticket_id": "...",
  "tier": "P0|P1|P2|P3",
  "quick_win": true|false,
  "quick_win_reason": "Why this is a quick win (only if quick_win is true)",
  "reasoning": "Brief explanation of priority tier",
  "suggested_action": "What to do next",
  "estimated_time": "5min|15min|30min|1hr|2hr+"
}`;

  const metricsData = tickets.map(({ ticket, metrics }) => ({
    ticket_id: ticket.id,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    ...metrics,
    is_vip: ticket.requester?.is_vip || false,
    requester_name: ticket.requester?.name || "Unknown",
    requester_department: ticket.requester?.department || "Unknown",
  }));

  const userPrompt = `Triage these tickets:\n\n${JSON.stringify(metricsData, null, 2)}`;

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const args = [
      "--print",
      "--model", "sonnet",
      "--tools", "",
      "--output-format", "text",
      "--setting-sources", "",
      "--system-prompt", systemPrompt,
      userPrompt,
    ];

    let stdout = "";
    let stderr = "";

    const proc = spawn("claude", args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("AI triage timeout after 120s"));
    }, 120000);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`AI triage failed: ${stderr}`));
        return;
      }

      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        reject(new Error(`No JSON found in AI response: ${stdout}`));
        return;
      }

      try {
        const results = JSON.parse(jsonMatch[0]) as Array<TriageResult & { ticket_id: string }>;
        const map = new Map<string, TriageResult>();
        for (const r of results) {
          map.set(r.ticket_id, {
            tier: r.tier,
            quick_win: r.quick_win,
            quick_win_reason: r.quick_win_reason,
            reasoning: r.reasoning,
            suggested_action: r.suggested_action,
            estimated_time: r.estimated_time,
          });
        }
        resolve(map);
      } catch (e) {
        reject(new Error(`Failed to parse AI JSON: ${e}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Update cache stats
 */
function updateStats(cache: TriageCache) {
  const tickets = Object.values(cache.tickets);
  cache.stats = {
    total: tickets.length,
    p0: tickets.filter((t) => t.triage.tier === "P0").length,
    p1: tickets.filter((t) => t.triage.tier === "P1").length,
    p2: tickets.filter((t) => t.triage.tier === "P2").length,
    p3: tickets.filter((t) => t.triage.tier === "P3").length,
    quick_wins: tickets.filter((t) => t.triage.quick_win).length,
  };
}

/**
 * Main sync function
 */
async function sync(force: boolean = false) {
  const cache = loadCache();
  const now = new Date().toISOString();

  log(`${c.cyan}Fetching SDP tickets...${c.reset}`);
  const tickets = await fetchTicketList();

  if (tickets.length === 0) {
    log(`${c.green}No active tickets.${c.reset}`);
    cache.last_sync = now;
    saveCache(cache);
    return;
  }

  log(`${c.dim}Found ${tickets.length} tickets${c.reset}`);

  // Find current ticket IDs
  const currentIds = new Set(tickets.map((t) => t.id));

  // Remove closed tickets from cache
  const removedIds: string[] = [];
  for (const id of Object.keys(cache.tickets)) {
    if (!currentIds.has(id)) {
      delete cache.tickets[id];
      removedIds.push(id);
    }
  }
  if (removedIds.length > 0) {
    log(`${c.dim}Removed ${removedIds.length} closed tickets from cache${c.reset}`);
  }

  // Find new or changed tickets
  const needsTriage: Array<{ ticket: TicketDetail; metrics: ReturnType<typeof calculateMetrics> }> = [];

  for (const rawTicket of tickets) {
    const cached = cache.tickets[rawTicket.id];
    const lastUpdated = rawTicket.last_updated_time || rawTicket.created_time;

    // Check if ticket is new or changed since last cache
    const isNew = !cached;
    const isChanged = cached && cached.ticket.last_updated_time !== lastUpdated;
    const needsRefresh = force || isNew || isChanged;

    if (needsRefresh) {
      // Fetch detail to get priority
      log(`${c.dim}  Fetching detail for #${rawTicket.id}...${c.reset}`);
      const detail = await fetchTicketDetail(rawTicket.id);

      if (detail) {
        const metrics = calculateMetrics(detail);
        needsTriage.push({ ticket: detail, metrics });
      }
    } else {
      // Update metrics for existing cached ticket (overdue status may change)
      const metrics = calculateMetrics(cached.ticket);
      cache.tickets[rawTicket.id].metrics = metrics;
      cache.tickets[rawTicket.id].last_synced = now;
    }
  }

  // Run AI triage on new/changed tickets
  if (needsTriage.length > 0) {
    log(`${c.cyan}Running AI triage on ${needsTriage.length} tickets...${c.reset}`);

    try {
      const triageResults = await runAiTriage(needsTriage);

      for (const { ticket, metrics } of needsTriage) {
        const triage = triageResults.get(ticket.id);
        if (triage) {
          cache.tickets[ticket.id] = {
            ticket,
            triage,
            metrics,
            cached_at: now,
            last_synced: now,
          };
        }
      }

      cache.last_full_triage = now;
    } catch (e) {
      error(`AI triage failed: ${e}`);
      // Still save partial cache
    }
  }

  cache.last_sync = now;
  updateStats(cache);
  saveCache(cache);

  log(`${c.green}Sync complete.${c.reset}`);
  log(`  Total: ${cache.stats.total} | P0: ${cache.stats.p0} | P1: ${cache.stats.p1} | P2: ${cache.stats.p2} | P3: ${cache.stats.p3} | Quick Wins: ${cache.stats.quick_wins}`);
}

/**
 * Show cache status
 */
function showStatus() {
  const cache = loadCache();

  console.log(`${c.bold}SDP Triage Cache Status${c.reset}`);
  console.log(`  Cache file: ${CACHE_FILE}`);
  console.log(`  Last sync: ${cache.last_sync || "never"}`);
  console.log(`  Last AI triage: ${cache.last_full_triage || "never"}`);
  console.log();
  console.log(`${c.bold}Ticket Counts${c.reset}`);
  console.log(`  Total: ${cache.stats.total}`);
  console.log(`  P0 Critical: ${c.red}${cache.stats.p0}${c.reset}`);
  console.log(`  P1 High: ${c.yellow}${cache.stats.p1}${c.reset}`);
  console.log(`  P2 Medium: ${cache.stats.p2}`);
  console.log(`  P3 Low: ${c.dim}${cache.stats.p3}${c.reset}`);
  console.log(`  Quick Wins: ${c.green}${cache.stats.quick_wins}${c.reset}`);
}

/**
 * Output cache as JSON
 */
function outputJson() {
  const cache = loadCache();
  console.log(JSON.stringify(cache, null, 2));
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status") || args.includes("-s")) {
    showStatus();
    return;
  }

  if (args.includes("--json") || args.includes("-j")) {
    outputJson();
    return;
  }

  const force = args.includes("--force") || args.includes("-f");

  try {
    await sync(force);
  } catch (e) {
    error(`Sync failed: ${e}`);
    process.exit(1);
  }
}

main();
