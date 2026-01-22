#!/usr/bin/env bun
/**
 * ============================================================================
 * REPLY - Send reply to SDP ticket requester
 * ============================================================================
 *
 * PURPOSE:
 * Sends a reply to the ticket requester (visible to them, sends email notification).
 *
 * USAGE:
 *   bun Reply.ts 12345 "Your issue has been resolved"
 *   bun Reply.ts 12345 "Working on it" --status "In Progress"
 *   bun Reply.ts 12345 "Fixed" --status "Resolved" --json
 *
 * ARGUMENTS:
 *   ticket_id       The SDP request ID
 *   reply_content   The reply message to send
 *
 * OPTIONS:
 *   --status <s>    Update ticket status (Open, In Progress, Pending, Resolved, Closed)
 *   --json          Output as JSON instead of text
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * BACKEND: Uses auth-keeper sdp via subscription-based CLI
 *
 * ============================================================================
 */

import { spawnSync } from "child_process";

interface ReplyResponse {
  success: boolean;
  reply_id?: string;
  error?: string;
  timestamp?: string;
  status_updated?: boolean;
  new_status?: string;
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
 * Send reply via auth-keeper
 */
async function sendReply(
  ticketId: string,
  content: string,
  status?: string
): Promise<ReplyResponse> {
  const escapedContent = content.replace(/'/g, "'\\''");
  const statusArg = status ? `--status '${status}'` : "";

  const result = spawnSync(
    "bash",
    [
      "-c",
      `ZONE=work source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && auth-keeper sdp reply ${ticketId} '${escapedContent}' ${statusArg} --json`,
    ],
    {
      encoding: "utf-8",
      timeout: 30000,
    }
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || "Failed to send reply",
    };
  }

  const output = result.stdout.trim();

  try {
    return JSON.parse(output);
  } catch {
    // If not JSON, check for success indicators
    if (output.includes("Reply sent") || output.includes("success")) {
      return {
        success: true,
        timestamp: new Date().toISOString(),
        status_updated: !!status,
        new_status: status,
      };
    }
    return {
      success: false,
      error: output || "Unknown error",
    };
  }
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

  // Extract --status value
  let status: string | undefined;
  const statusIdx = args.indexOf("--status");
  if (statusIdx !== -1 && args[statusIdx + 1]) {
    status = args[statusIdx + 1];
  }

  // Filter out flags and their values to get positional args
  const positionalArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") || args[i].startsWith("-")) {
      // Skip flag and its value if it's --status
      if (args[i] === "--status" && args[i + 1]) {
        i++;
      }
      continue;
    }
    positionalArgs.push(args[i]);
  }

  if (flags.help || positionalArgs.length < 2) {
    console.log(`
${colors.bold}Reply - Send Reply to SDP Ticket${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun Reply.ts <ticket_id> "reply message" [options]

${colors.cyan}Arguments:${colors.reset}
  ticket_id       The SDP request ID (e.g., 12345)
  reply_content   The reply message (in quotes)

${colors.cyan}Options:${colors.reset}
  --status <s>    Update ticket status:
                  - Open
                  - In Progress
                  - Pending
                  - On Hold
                  - Resolved
                  - Closed
  --json          Output as JSON
  --quiet         Minimal output
  --help          Show this help

${colors.cyan}Examples:${colors.reset}
  bun Reply.ts 12345 "I'm investigating this issue now" --status "In Progress"
  bun Reply.ts 12345 "Issue resolved. The DNS cache was cleared." --status "Resolved"
  bun Reply.ts 12345 "Could you please provide more details about the error?"

${colors.cyan}Reply Templates:${colors.reset}

  ${colors.dim}Acknowledging:${colors.reset}
  "Thank you for reporting this issue. I'm currently investigating and will update you shortly."

  ${colors.dim}Requesting Info:${colors.reset}
  "To help resolve this issue, could you please provide: 1) When did this start? 2) Any error messages? 3) Has anything changed recently?"

  ${colors.dim}Resolved:${colors.reset}
  "This issue has been resolved. [Explanation]. Please let me know if you experience any further problems."
`);
    process.exit(flags.help ? 0 : 1);
  }

  const ticketId = positionalArgs[0];
  const replyContent = positionalArgs.slice(1).join(" ");

  if (!ticketId.match(/^\d+$/)) {
    error(`Invalid ticket ID: ${ticketId}`);
    process.exit(1);
  }

  if (!replyContent.trim()) {
    error("Reply content cannot be empty");
    process.exit(1);
  }

  // Validate status if provided
  const validStatuses = [
    "Open",
    "In Progress",
    "Pending",
    "On Hold",
    "Resolved",
    "Closed",
  ];
  if (status && !validStatuses.includes(status)) {
    error(
      `Invalid status: ${status}. Valid options: ${validStatuses.join(", ")}`
    );
    process.exit(1);
  }

  log(
    `${colors.cyan}Sending reply to ticket #${ticketId}...${colors.reset}`,
    flags.quiet
  );

  const response = await sendReply(ticketId, replyContent, status);

  if (flags.json) {
    console.log(JSON.stringify(response, null, 2));
  } else {
    if (response.success) {
      console.log(`${colors.green}✓ Reply sent to ticket #${ticketId}${colors.reset}`);
      if (response.reply_id) {
        console.log(`  Reply ID: ${response.reply_id}`);
      }
      console.log(`  Time: ${response.timestamp || new Date().toISOString()}`);
      if (response.status_updated && response.new_status) {
        console.log(`  Status: Updated to "${response.new_status}"`);
      }
      console.log(`  Message: ${replyContent.slice(0, 60)}${replyContent.length > 60 ? "..." : ""}`);
      console.log(`\n${colors.dim}The requester has been notified via email.${colors.reset}`);
    } else {
      error(`Failed to send reply: ${response.error}`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
