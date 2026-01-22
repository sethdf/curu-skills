#!/usr/bin/env bun
/**
 * ============================================================================
 * TRIAGE - AI-powered SDP ticket prioritization CLI
 * ============================================================================
 *
 * PURPOSE:
 * Standalone CLI for triaging SDP tickets using AI inference.
 * Can run headless (cron) or interactive (CLI).
 *
 * USAGE:
 *   bun Triage.ts                     # Triage all assigned tickets
 *   bun Triage.ts --quick-wins        # Show only quick wins
 *   bun Triage.ts --critical          # Show only P0/P1 tickets
 *   bun Triage.ts --json              # Output as JSON
 *   bun Triage.ts --notify            # Send notification on completion
 *   bun Triage.ts --dry-run           # Fetch and analyze without AI (for testing)
 *
 * OPTIONS:
 *   --quick-wins    Show only tickets flagged as quick wins
 *   --critical      Show only P0 and P1 tickets
 *   --json          Output as JSON instead of markdown
 *   --notify        Send voice notification on completion
 *   --dry-run       Skip AI inference, show raw ticket data
 *   --limit <n>     Maximum tickets to process (default: 50)
 *   --quiet         Minimal output for cron jobs
 *
 * BILLING: Uses Claude CLI with subscription (not API key)
 *
 * ============================================================================
 */

import { spawn, spawnSync } from "child_process";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  due_by_time?: string;
  created_time: string;
  last_updated_time?: string;
  requester?: {
    name: string;
    email: string;
    is_vip?: boolean;
    department?: string;
  };
}

interface TicketMetrics {
  ticket_id: string;
  subject: string;
  priority: string;
  status: string;
  days_open: number;
  hours_awaiting_response: number | null;
  is_overdue: boolean;
  days_overdue: number;
  is_vip: boolean;
  requester_name: string;
  requester_department: string;
}

interface TriageResult {
  ticket_id: string;
  tier: "P0" | "P1" | "P2" | "P3";
  quick_win: boolean;
  quick_win_reason?: string;
  reasoning: string;
  suggested_action: string;
  estimated_time: string;
}

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function log(msg: string, quiet: boolean = false) {
  if (!quiet) console.log(msg);
}

function error(msg: string) {
  console.error(`${colors.red}Error: ${msg}${colors.reset}`);
}

/**
 * Fetch tickets from SDP via auth-keeper
 */
async function fetchTickets(): Promise<Ticket[]> {
  const result = spawnSync("auth-keeper", ["sdp"], {
    encoding: "utf-8",
    timeout: 30000,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to fetch tickets: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse ticket response: ${result.stdout}`);
  }
}

/**
 * Calculate metrics for each ticket
 */
function calculateMetrics(tickets: Ticket[]): TicketMetrics[] {
  const now = Date.now();

  return tickets.map((ticket) => {
    const createdTime = new Date(ticket.created_time).getTime();
    const dueTime = ticket.due_by_time
      ? new Date(ticket.due_by_time).getTime()
      : null;
    const lastUpdated = ticket.last_updated_time
      ? new Date(ticket.last_updated_time).getTime()
      : createdTime;

    const daysOpen = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
    const isOverdue = dueTime ? now > dueTime : false;
    const daysOverdue = isOverdue
      ? Math.floor((now - dueTime!) / (1000 * 60 * 60 * 24))
      : 0;

    // Hours since last update (proxy for awaiting response)
    const hoursSinceUpdate = Math.floor((now - lastUpdated) / (1000 * 60 * 60));

    return {
      ticket_id: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority || "Medium",
      status: ticket.status,
      days_open: daysOpen,
      hours_awaiting_response: hoursSinceUpdate > 24 ? hoursSinceUpdate : null,
      is_overdue: isOverdue,
      days_overdue: daysOverdue,
      is_vip: ticket.requester?.is_vip || false,
      requester_name: ticket.requester?.name || "Unknown",
      requester_department: ticket.requester?.department || "Unknown",
    };
  });
}

/**
 * Run AI inference to categorize tickets
 */
async function runInference(
  metrics: TicketMetrics[]
): Promise<TriageResult[]> {
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

  const userPrompt = `Triage these tickets:\n\n${JSON.stringify(metrics, null, 2)}`;

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
      reject(new Error("Inference timeout after 60s"));
    }, 60000);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`Inference failed: ${stderr}`));
        return;
      }

      // Extract JSON from response
      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        reject(new Error(`No JSON found in response: ${stdout}`));
        return;
      }

      try {
        const results = JSON.parse(jsonMatch[0]) as TriageResult[];
        resolve(results);
      } catch (e) {
        reject(new Error(`Failed to parse JSON: ${e}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Format results as markdown
 */
function formatMarkdown(results: TriageResult[], metrics: TicketMetrics[]): string {
  const metricsMap = new Map(metrics.map((m) => [m.ticket_id, m]));

  const quickWins = results.filter((r) => r.quick_win);
  const p0 = results.filter((r) => r.tier === "P0");
  const p1 = results.filter((r) => r.tier === "P1");
  const p2 = results.filter((r) => r.tier === "P2");
  const p3 = results.filter((r) => r.tier === "P3");

  let output = `# Ticket Triage Report\n`;
  output += `*Generated: ${new Date().toISOString()}*\n`;
  output += `*Tickets analyzed: ${results.length}*\n\n`;
  output += `---\n\n`;

  // Quick Wins
  if (quickWins.length > 0) {
    output += `## Quick Wins (Clear These Fast)\n\n`;
    output += `| ID | Subject | Est. Time | Tier | Why Quick |\n`;
    output += `|----|---------|-----------|------|----------|\n`;
    for (const r of quickWins) {
      const m = metricsMap.get(r.ticket_id);
      output += `| #${r.ticket_id} | ${m?.subject?.slice(0, 30) || "?"} | ${r.estimated_time} | ${r.tier} | ${r.quick_win_reason || ""} |\n`;
    }
    output += `\n---\n\n`;
  }

  // P0 Critical
  if (p0.length > 0) {
    output += `## P0 - Critical (Handle Immediately)\n\n`;
    output += `| ID | Subject | Days Open | Reason |\n`;
    output += `|----|---------|-----------|--------|\n`;
    for (const r of p0) {
      const m = metricsMap.get(r.ticket_id);
      output += `| #${r.ticket_id} | ${m?.subject?.slice(0, 30) || "?"} | ${m?.days_open || "?"} | ${r.reasoning} |\n`;
    }
    output += `\n**Actions:**\n`;
    for (const r of p0) {
      output += `- #${r.ticket_id}: ${r.suggested_action}\n`;
    }
    output += `\n---\n\n`;
  }

  // P1 High
  if (p1.length > 0) {
    output += `## P1 - High (Handle Today)\n\n`;
    output += `| ID | Subject | Days Open | Reason |\n`;
    output += `|----|---------|-----------|--------|\n`;
    for (const r of p1) {
      const m = metricsMap.get(r.ticket_id);
      output += `| #${r.ticket_id} | ${m?.subject?.slice(0, 30) || "?"} | ${m?.days_open || "?"} | ${r.reasoning} |\n`;
    }
    output += `\n---\n\n`;
  }

  // P2 Medium
  if (p2.length > 0) {
    output += `## P2 - Medium (This Week)\n\n`;
    output += `| ID | Subject | Days Open | Reason |\n`;
    output += `|----|---------|-----------|--------|\n`;
    for (const r of p2) {
      const m = metricsMap.get(r.ticket_id);
      output += `| #${r.ticket_id} | ${m?.subject?.slice(0, 30) || "?"} | ${m?.days_open || "?"} | ${r.reasoning} |\n`;
    }
    output += `\n---\n\n`;
  }

  // P3 Low
  if (p3.length > 0) {
    output += `## P3 - Low (When Able)\n\n`;
    output += `| ID | Subject | Days Open | Status |\n`;
    output += `|----|---------|-----------|--------|\n`;
    for (const r of p3) {
      const m = metricsMap.get(r.ticket_id);
      output += `| #${r.ticket_id} | ${m?.subject?.slice(0, 30) || "?"} | ${m?.days_open || "?"} | ${m?.status || "?"} |\n`;
    }
    output += `\n---\n\n`;
  }

  // Summary
  output += `## Summary\n\n`;
  output += `| Category | Count |\n`;
  output += `|----------|-------|\n`;
  output += `| P0 Critical | ${p0.length} |\n`;
  output += `| P1 High | ${p1.length} |\n`;
  output += `| P2 Medium | ${p2.length} |\n`;
  output += `| P3 Low | ${p3.length} |\n`;
  output += `| Quick Wins | ${quickWins.length} |\n`;
  output += `| **Total** | ${results.length} |\n`;

  return output;
}

/**
 * Send notification
 */
function notify(message: string) {
  spawn("curl", [
    "-s",
    "-X", "POST",
    "http://localhost:8888/notify",
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({ message }),
  ], { stdio: "ignore" });
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {
    quickWins: args.includes("--quick-wins"),
    critical: args.includes("--critical"),
    json: args.includes("--json"),
    notify: args.includes("--notify"),
    dryRun: args.includes("--dry-run"),
    quiet: args.includes("--quiet"),
    help: args.includes("--help") || args.includes("-h"),
  };

  let limit = 50;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  if (flags.help) {
    console.log(`
${colors.bold}SDP Triage CLI${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun Triage.ts [options]

${colors.cyan}Options:${colors.reset}
  --quick-wins    Show only quick wins
  --critical      Show only P0/P1 tickets
  --json          Output as JSON
  --notify        Send voice notification
  --dry-run       Skip AI inference
  --limit <n>     Max tickets (default: 50)
  --quiet         Minimal output
  --help          Show this help
`);
    process.exit(0);
  }

  log(`${colors.cyan}Fetching SDP tickets...${colors.reset}`, flags.quiet);

  let tickets: Ticket[];
  try {
    tickets = await fetchTickets();
  } catch (e) {
    error(`Failed to fetch tickets: ${e}`);
    process.exit(1);
  }

  if (tickets.length === 0) {
    log(`${colors.green}No tickets assigned.${colors.reset}`, flags.quiet);
    process.exit(0);
  }

  tickets = tickets.slice(0, limit);
  log(`${colors.dim}Found ${tickets.length} tickets${colors.reset}`, flags.quiet);

  const metrics = calculateMetrics(tickets);

  if (flags.dryRun) {
    if (flags.json) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log("Ticket Metrics (dry-run, no AI):");
      console.log(JSON.stringify(metrics, null, 2));
    }
    process.exit(0);
  }

  log(`${colors.cyan}Running AI triage...${colors.reset}`, flags.quiet);

  let results: TriageResult[];
  try {
    results = await runInference(metrics);
  } catch (e) {
    error(`AI inference failed: ${e}`);
    process.exit(1);
  }

  // Filter if needed
  if (flags.quickWins) {
    results = results.filter((r) => r.quick_win);
  } else if (flags.critical) {
    results = results.filter((r) => r.tier === "P0" || r.tier === "P1");
  }

  // Output
  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatMarkdown(results, metrics));
  }

  // Notification
  if (flags.notify) {
    const p0Count = results.filter((r) => r.tier === "P0").length;
    const qwCount = results.filter((r) => r.quick_win).length;
    const msg = `Triage complete. ${p0Count} critical, ${qwCount} quick wins.`;
    notify(msg);
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
