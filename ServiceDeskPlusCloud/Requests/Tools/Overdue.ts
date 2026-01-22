#!/usr/bin/env bun
/**
 * ============================================================================
 * OVERDUE - Fetch overdue SDP tickets
 * ============================================================================
 *
 * PURPOSE:
 * Retrieves tickets that are past their due date from ServiceDesk Plus.
 *
 * USAGE:
 *   bun Overdue.ts                  # Show overdue tickets (markdown)
 *   bun Overdue.ts --json           # Output as JSON
 *   bun Overdue.ts --limit 10       # Limit results
 *   bun Overdue.ts --quiet          # Minimal output
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

interface OverdueTicket extends Ticket {
  days_overdue: number;
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
      "ZONE=work source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && auth-keeper sdp overdue --json",
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

  if (output.startsWith("No overdue tickets") || output.startsWith("No active tickets")) {
    return [];
  }

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Failed to parse ticket response: ${output}`);
  }
}

/**
 * Calculate days overdue for each ticket
 */
function calculateOverdue(tickets: Ticket[]): OverdueTicket[] {
  const now = Date.now();

  return tickets
    .map((ticket) => {
      const dueTime = ticket.due_by_time ? parseInt(ticket.due_by_time, 10) : null;
      if (!dueTime || dueTime > now) return null;

      const daysOverdue = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));

      return {
        ...ticket,
        days_overdue: daysOverdue,
      };
    })
    .filter((t): t is OverdueTicket => t !== null)
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

/**
 * Format overdue tickets as markdown
 */
function formatMarkdown(tickets: OverdueTicket[]): string {
  let output = `# Overdue Tickets\n`;
  output += `*Generated: ${new Date().toISOString()}*\n`;
  output += `*Total overdue: ${tickets.length} tickets*\n\n`;

  if (tickets.length === 0) {
    output += `${colors.green}No overdue tickets!${colors.reset}\n`;
    return output;
  }

  // Severity breakdown
  const critical = tickets.filter((t) => t.days_overdue > 7);
  const warning = tickets.filter((t) => t.days_overdue >= 3 && t.days_overdue <= 7);
  const minor = tickets.filter((t) => t.days_overdue < 3);

  output += `## Severity Breakdown\n`;
  output += `| Severity | Count | Days Overdue |\n`;
  output += `|----------|-------|--------------|\n`;
  output += `| 🔴 Critical | ${critical.length} | >7 days |\n`;
  output += `| 🟡 Warning | ${warning.length} | 3-7 days |\n`;
  output += `| 🟢 Minor | ${minor.length} | <3 days |\n\n`;

  output += `---\n\n`;

  // Ticket table
  output += `| ID | Subject | Days Overdue | Priority | Requester | Last Updated |\n`;
  output += `|----|---------|--------------|----------|-----------|-------------|\n`;

  for (const ticket of tickets) {
    const lastUpdated = ticket.last_updated_time
      ? new Date(parseInt(ticket.last_updated_time, 10)).toLocaleDateString()
      : "N/A";
    const requester = ticket.requester?.name || "Unknown";
    const vipBadge = ticket.requester?.is_vip ? " ⭐" : "";

    const severityIcon =
      ticket.days_overdue > 7 ? "🔴" : ticket.days_overdue >= 3 ? "🟡" : "🟢";

    output += `| #${ticket.id} | ${ticket.subject.slice(0, 35)} | ${severityIcon} ${ticket.days_overdue} | ${ticket.priority} | ${requester}${vipBadge} | ${lastUpdated} |\n`;
  }

  // Recommendations
  if (critical.length > 0) {
    output += `\n---\n\n`;
    output += `## Recommended Actions\n\n`;

    for (const ticket of critical.slice(0, 5)) {
      output += `### #${ticket.id} - ${ticket.days_overdue} days overdue\n`;
      output += `- **Subject:** ${ticket.subject}\n`;
      output += `- **Requester:** ${ticket.requester?.name || "Unknown"}${ticket.requester?.is_vip ? " (VIP)" : ""}\n`;
      output += `- **Recommended:** `;

      if (ticket.days_overdue > 14) {
        output += `Escalate to manager, consider closure if abandoned\n`;
      } else if (ticket.days_overdue > 7) {
        output += `Send status update to requester, escalate if blocked\n`;
      } else {
        output += `Prioritize resolution today\n`;
      }
      output += `\n`;
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
${colors.bold}Overdue - SDP Overdue Tickets${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun Overdue.ts [options]

${colors.cyan}Options:${colors.reset}
  --json          Output as JSON
  --limit <n>     Max tickets (default: 50)
  --quiet         Minimal output
  --help          Show this help
`);
    process.exit(0);
  }

  log(`${colors.cyan}Fetching overdue tickets...${colors.reset}`, flags.quiet);

  let tickets: Ticket[];
  try {
    tickets = await fetchTickets();
  } catch (e) {
    error(`Failed to fetch tickets: ${e}`);
    process.exit(1);
  }

  const overdueTickets = calculateOverdue(tickets).slice(0, limit);

  if (flags.json) {
    console.log(JSON.stringify(overdueTickets, null, 2));
  } else {
    console.log(formatMarkdown(overdueTickets));
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
