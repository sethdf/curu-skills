#!/usr/bin/env bun
/**
 * ============================================================================
 * MYTICKETS - Fetch assigned SDP tickets for the current technician
 * ============================================================================
 *
 * PURPOSE:
 * Retrieves tickets assigned to the technician from ServiceDesk Plus.
 *
 * USAGE:
 *   bun MyTickets.ts                # Show assigned tickets (markdown)
 *   bun MyTickets.ts --json         # Output as JSON
 *   bun MyTickets.ts --limit 10     # Limit results
 *   bun MyTickets.ts --quiet        # Minimal output
 *
 * OPTIONS:
 *   --json          Output as JSON instead of markdown
 *   --limit <n>     Maximum tickets to return (default: 50)
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * BACKEND: Uses auth-keeper sdp via subscription-based CLI
 *
 * ============================================================================
 */

import { spawnSync } from "child_process";

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
 * Format tickets as markdown table
 */
function formatMarkdown(tickets: Ticket[]): string {
  const now = Date.now();

  let output = `# My Assigned Tickets\n`;
  output += `*Generated: ${new Date().toISOString()}*\n`;
  output += `*Total: ${tickets.length} tickets*\n\n`;

  if (tickets.length === 0) {
    output += `No active tickets assigned.\n`;
    return output;
  }

  // Summary stats
  let overdue = 0;
  let highPriority = 0;
  let dueToday = 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  for (const ticket of tickets) {
    const dueTime = ticket.due_by_time ? parseInt(ticket.due_by_time, 10) : null;
    if (dueTime && dueTime < now) overdue++;
    if (dueTime && dueTime >= todayStart.getTime() && dueTime <= todayEnd.getTime()) dueToday++;
    if (ticket.priority === "High" || ticket.priority === "Urgent") highPriority++;
  }

  output += `## Summary\n`;
  output += `| Metric | Count |\n`;
  output += `|--------|-------|\n`;
  output += `| Total Open | ${tickets.length} |\n`;
  output += `| ${colors.red}Overdue${colors.reset} | ${overdue} |\n`;
  output += `| High Priority | ${highPriority} |\n`;
  output += `| Due Today | ${dueToday} |\n\n`;

  output += `---\n\n`;

  // Ticket table
  output += `| ID | Subject | Status | Priority | Due Date | Requester |\n`;
  output += `|----|---------|--------|----------|----------|----------|\n`;

  for (const ticket of tickets) {
    const dueTime = ticket.due_by_time ? parseInt(ticket.due_by_time, 10) : null;
    const dueDate = dueTime ? new Date(dueTime).toLocaleDateString() : "N/A";
    const isOverdue = dueTime && dueTime < now;
    const requester = ticket.requester?.name || "Unknown";
    const vipBadge = ticket.requester?.is_vip ? " ⭐" : "";

    const overdueMarker = isOverdue ? " 🔴" : "";

    output += `| #${ticket.id} | ${ticket.subject.slice(0, 40)} | ${ticket.status} | ${ticket.priority} | ${dueDate}${overdueMarker} | ${requester}${vipBadge} |\n`;
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
${colors.bold}MyTickets - SDP Assigned Tickets${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun MyTickets.ts [options]

${colors.cyan}Options:${colors.reset}
  --json          Output as JSON
  --limit <n>     Max tickets (default: 50)
  --quiet         Minimal output
  --help          Show this help
`);
    process.exit(0);
  }

  log(`${colors.cyan}Fetching assigned tickets...${colors.reset}`, flags.quiet);

  let tickets: Ticket[];
  try {
    tickets = await fetchTickets();
  } catch (e) {
    error(`Failed to fetch tickets: ${e}`);
    process.exit(1);
  }

  tickets = tickets.slice(0, limit);

  if (flags.json) {
    console.log(JSON.stringify(tickets, null, 2));
  } else {
    console.log(formatMarkdown(tickets));
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
