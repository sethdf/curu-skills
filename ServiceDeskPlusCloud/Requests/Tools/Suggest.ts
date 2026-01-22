#!/usr/bin/env bun
/**
 * ============================================================================
 * SUGGEST - AI-powered ticket recommendation
 * ============================================================================
 *
 * PURPOSE:
 * Analyzes assigned tickets and recommends which one to work on next.
 *
 * USAGE:
 *   bun Suggest.ts                  # Get ticket recommendation
 *   bun Suggest.ts --json           # Output as JSON
 *   bun Suggest.ts --top 5          # Show top N recommendations
 *   bun Suggest.ts --quick          # Skip AI, use heuristic scoring
 *
 * OPTIONS:
 *   --json          Output as JSON instead of markdown
 *   --top <n>       Show top N recommendations (default: 3)
 *   --quick         Use heuristic scoring (no AI)
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * BACKEND: Uses auth-keeper sdp + Claude CLI for AI inference
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

interface ScoredTicket extends Ticket {
  score: number;
  factors: string[];
}

interface AISuggestion {
  ticket_id: string;
  score: number;
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
  const result = spawnSync(
    "bash",
    [
      "-c",
      "ZONE=work source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && auth-keeper sdp --json",
    ],
    {
      encoding: "utf-8",
      timeout: 30000,
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to fetch tickets: ${result.stderr}`);
  }

  const output = result.stdout.trim();

  if (output.startsWith("No active tickets")) {
    return [];
  }

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Failed to parse ticket response: ${output}`);
  }
}

/**
 * Heuristic scoring algorithm (quick mode)
 */
function scoreTicketsHeuristic(tickets: Ticket[]): ScoredTicket[] {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return tickets
    .map((ticket) => {
      let score = 0;
      const factors: string[] = [];

      const dueTime = ticket.due_by_time ? parseInt(ticket.due_by_time, 10) : null;
      const createdTime = parseInt(ticket.created_time, 10) || now;
      const lastUpdated = ticket.last_updated_time
        ? parseInt(ticket.last_updated_time, 10)
        : createdTime;

      // Overdue factor (40 base + 10 per day, max 80)
      if (dueTime && dueTime < now) {
        const daysOverdue = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
        score += 40 + Math.min(daysOverdue * 10, 40);
        factors.push(`Overdue by ${daysOverdue} day(s) (+${40 + Math.min(daysOverdue * 10, 40)})`);
      }

      // Priority factor (max 25)
      const priorityScores: Record<string, number> = {
        Urgent: 25,
        High: 20,
        Medium: 10,
        Low: 5,
      };
      const priorityScore = priorityScores[ticket.priority] || 5;
      score += priorityScore;
      factors.push(`${ticket.priority} priority (+${priorityScore})`);

      // Due soon factor (max 20)
      if (dueTime) {
        if (dueTime >= todayStart.getTime() && dueTime <= todayEnd.getTime()) {
          score += 20;
          factors.push("Due today (+20)");
        } else if (dueTime <= tomorrowEnd.getTime()) {
          score += 15;
          factors.push("Due tomorrow (+15)");
        } else if (dueTime <= weekEnd.getTime()) {
          score += 10;
          factors.push("Due this week (+10)");
        }
      }

      // VIP factor (10)
      if (ticket.requester?.is_vip) {
        score += 10;
        factors.push("VIP requester (+10)");
      }

      // Waiting time factor (max 10)
      const daysSinceUpdate = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
      const waitingScore = Math.min(daysSinceUpdate, 10);
      if (waitingScore > 0) {
        score += waitingScore;
        factors.push(`${daysSinceUpdate} days since update (+${waitingScore})`);
      }

      return {
        ...ticket,
        score,
        factors,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * AI-powered suggestion via Claude CLI
 */
async function getAISuggestions(tickets: Ticket[]): Promise<AISuggestion[]> {
  const systemPrompt = `You are an IT helpdesk prioritization expert. Analyze these tickets and recommend which to work on first.

For each ticket, provide:
1. A score (0-100) based on urgency, impact, and strategic value
2. Brief reasoning for the score
3. Suggested first action
4. Estimated time to resolve

Consider:
- Overdue tickets need immediate attention
- VIP requesters may have business-critical needs
- Quick wins (simple issues) can reduce queue efficiently
- Patterns in multiple tickets may indicate systemic issues

Output ONLY a JSON array (no markdown) with objects:
{
  "ticket_id": "...",
  "score": 0-100,
  "reasoning": "Brief explanation",
  "suggested_action": "What to do first",
  "estimated_time": "5min|15min|30min|1hr|2hr+"
}

Sort by score descending (highest priority first).`;

  const ticketSummary = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    due_by_time: t.due_by_time,
    created_time: t.created_time,
    requester_name: t.requester?.name,
    is_vip: t.requester?.is_vip,
  }));

  const userPrompt = `Analyze and prioritize these ${tickets.length} tickets:\n\n${JSON.stringify(ticketSummary, null, 2)}`;

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const args = [
      "--print",
      "--model",
      "haiku",
      "--tools",
      "",
      "--output-format",
      "text",
      "--setting-sources",
      "",
      "--system-prompt",
      systemPrompt,
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
      reject(new Error("AI inference timeout after 60s"));
    }, 60000);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`AI inference failed: ${stderr}`));
        return;
      }

      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        reject(new Error(`No JSON found in AI response: ${stdout}`));
        return;
      }

      try {
        const results = JSON.parse(jsonMatch[0]) as AISuggestion[];
        resolve(results);
      } catch (e) {
        reject(new Error(`Failed to parse AI response: ${e}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Format recommendations as markdown
 */
function formatMarkdown(
  tickets: Ticket[],
  scored: ScoredTicket[],
  aiSuggestions?: AISuggestion[],
  top: number = 3
): string {
  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  let output = `# Ticket Recommendation\n`;
  output += `*Generated: ${new Date().toISOString()}*\n`;
  output += `*Analyzed: ${tickets.length} tickets*\n\n`;

  if (tickets.length === 0) {
    output += `No tickets to analyze.\n`;
    return output;
  }

  if (aiSuggestions && aiSuggestions.length > 0) {
    // AI-powered output
    const topSuggestion = aiSuggestions[0];
    const topTicket = ticketMap.get(topSuggestion.ticket_id);

    output += `## 🎯 Recommended: #${topSuggestion.ticket_id}\n\n`;
    output += `**${topTicket?.subject || "Unknown"}**\n\n`;
    output += `| Attribute | Value |\n`;
    output += `|-----------|-------|\n`;
    output += `| Score | ${topSuggestion.score}/100 |\n`;
    output += `| Priority | ${topTicket?.priority || "Unknown"} |\n`;
    output += `| Requester | ${topTicket?.requester?.name || "Unknown"}${topTicket?.requester?.is_vip ? " ⭐" : ""} |\n`;
    output += `| Est. Time | ${topSuggestion.estimated_time} |\n\n`;
    output += `**Why this ticket?**\n${topSuggestion.reasoning}\n\n`;
    output += `**Suggested action:**\n${topSuggestion.suggested_action}\n\n`;

    if (aiSuggestions.length > 1) {
      output += `---\n\n`;
      output += `## Runner-Up Tickets\n\n`;
      output += `| Rank | ID | Subject | Score | Est. Time |\n`;
      output += `|------|-----|---------|-------|----------|\n`;

      for (let i = 1; i < Math.min(aiSuggestions.length, top); i++) {
        const s = aiSuggestions[i];
        const t = ticketMap.get(s.ticket_id);
        output += `| ${i + 1} | #${s.ticket_id} | ${t?.subject?.slice(0, 30) || "?"} | ${s.score} | ${s.estimated_time} |\n`;
      }
    }
  } else {
    // Heuristic output
    const topTicket = scored[0];

    output += `## 🎯 Recommended: #${topTicket.id}\n\n`;
    output += `**${topTicket.subject}**\n\n`;
    output += `| Attribute | Value |\n`;
    output += `|-----------|-------|\n`;
    output += `| Score | ${topTicket.score}/100 |\n`;
    output += `| Priority | ${topTicket.priority} |\n`;
    output += `| Status | ${topTicket.status} |\n`;
    output += `| Requester | ${topTicket.requester?.name || "Unknown"}${topTicket.requester?.is_vip ? " ⭐" : ""} |\n\n`;

    output += `**Scoring factors:**\n`;
    for (const factor of topTicket.factors) {
      output += `- ${factor}\n`;
    }
    output += `\n`;

    if (scored.length > 1) {
      output += `---\n\n`;
      output += `## Runner-Up Tickets\n\n`;
      output += `| Rank | ID | Subject | Score | Key Factor |\n`;
      output += `|------|-----|---------|-------|------------|\n`;

      for (let i = 1; i < Math.min(scored.length, top); i++) {
        const t = scored[i];
        output += `| ${i + 1} | #${t.id} | ${t.subject.slice(0, 30)} | ${t.score} | ${t.factors[0] || ""} |\n`;
      }
    }
  }

  return output;
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  const flags = {
    json: args.includes("--json"),
    quick: args.includes("--quick"),
    quiet: args.includes("--quiet"),
    help: args.includes("--help") || args.includes("-h"),
  };

  let top = 3;
  const topIdx = args.indexOf("--top");
  if (topIdx !== -1 && args[topIdx + 1]) {
    top = parseInt(args[topIdx + 1], 10);
  }

  if (flags.help) {
    console.log(`
${colors.bold}Suggest - AI Ticket Recommendation${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun Suggest.ts [options]

${colors.cyan}Options:${colors.reset}
  --json          Output as JSON
  --top <n>       Show top N recommendations (default: 3)
  --quick         Use heuristic scoring (no AI)
  --quiet         Minimal output
  --help          Show this help
`);
    process.exit(0);
  }

  log(`${colors.cyan}Fetching tickets...${colors.reset}`, flags.quiet);

  let tickets: Ticket[];
  try {
    tickets = await fetchTickets();
  } catch (e) {
    error(`Failed to fetch tickets: ${e}`);
    process.exit(1);
  }

  if (tickets.length === 0) {
    log(`${colors.green}No tickets to analyze.${colors.reset}`, flags.quiet);
    process.exit(0);
  }

  const scored = scoreTicketsHeuristic(tickets);

  let aiSuggestions: AISuggestion[] | undefined;

  if (!flags.quick) {
    log(`${colors.cyan}Running AI analysis...${colors.reset}`, flags.quiet);
    try {
      aiSuggestions = await getAISuggestions(tickets);
    } catch (e) {
      log(`${colors.yellow}AI analysis failed, using heuristic: ${e}${colors.reset}`, flags.quiet);
    }
  }

  if (flags.json) {
    if (aiSuggestions) {
      console.log(JSON.stringify(aiSuggestions.slice(0, top), null, 2));
    } else {
      console.log(
        JSON.stringify(
          scored.slice(0, top).map((t) => ({
            ticket_id: t.id,
            score: t.score,
            factors: t.factors,
            subject: t.subject,
            priority: t.priority,
          })),
          null,
          2
        )
      );
    }
  } else {
    console.log(formatMarkdown(tickets, scored, aiSuggestions, top));
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
