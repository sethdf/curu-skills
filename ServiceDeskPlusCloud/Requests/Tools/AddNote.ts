#!/usr/bin/env bun
/**
 * ============================================================================
 * ADDNOTE - Add internal note to SDP ticket
 * ============================================================================
 *
 * PURPOSE:
 * Adds an internal note (not visible to requester) to a ServiceDesk Plus ticket.
 *
 * USAGE:
 *   bun AddNote.ts 12345 "Investigation findings here"
 *   bun AddNote.ts 12345 "Note content" --public     # Visible to requester
 *   bun AddNote.ts 12345 "Note content" --json       # Output as JSON
 *
 * ARGUMENTS:
 *   ticket_id       The SDP request ID
 *   note_content    The note text to add
 *
 * OPTIONS:
 *   --public        Make note visible to requester (default: internal only)
 *   --json          Output as JSON instead of text
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * BACKEND: Uses auth-keeper sdp via subscription-based CLI
 *
 * ============================================================================
 */

import { spawnSync } from "child_process";

interface NoteResponse {
  success: boolean;
  note_id?: string;
  error?: string;
  timestamp?: string;
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
 * Add note to ticket via auth-keeper
 */
async function addNote(
  ticketId: string,
  content: string,
  isPublic: boolean
): Promise<NoteResponse> {
  const visibility = isPublic ? "--public" : "";
  const escapedContent = content.replace(/'/g, "'\\''");

  const result = spawnSync(
    "bash",
    [
      "-c",
      `ZONE=work source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh && auth-keeper sdp note ${ticketId} '${escapedContent}' ${visibility} --json`,
    ],
    {
      encoding: "utf-8",
      timeout: 30000,
    }
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || "Failed to add note",
    };
  }

  const output = result.stdout.trim();

  try {
    return JSON.parse(output);
  } catch {
    // If not JSON, check for success indicators
    if (output.includes("Note added") || output.includes("success")) {
      return {
        success: true,
        timestamp: new Date().toISOString(),
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
    public: args.includes("--public"),
    json: args.includes("--json"),
    quiet: args.includes("--quiet"),
    help: args.includes("--help") || args.includes("-h"),
  };

  // Filter out flags to get positional args
  const positionalArgs = args.filter(
    (a) => !a.startsWith("--") && !a.startsWith("-")
  );

  if (flags.help || positionalArgs.length < 2) {
    console.log(`
${colors.bold}AddNote - Add Internal Note to SDP Ticket${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun AddNote.ts <ticket_id> "note content" [options]

${colors.cyan}Arguments:${colors.reset}
  ticket_id       The SDP request ID (e.g., 12345)
  note_content    The note text to add (in quotes)

${colors.cyan}Options:${colors.reset}
  --public        Make note visible to requester
  --json          Output as JSON
  --quiet         Minimal output
  --help          Show this help

${colors.cyan}Examples:${colors.reset}
  bun AddNote.ts 12345 "Investigated root cause - DNS resolution failure"
  bun AddNote.ts 12345 "Status update for customer" --public
`);
    process.exit(flags.help ? 0 : 1);
  }

  const ticketId = positionalArgs[0];
  const noteContent = positionalArgs.slice(1).join(" ");

  if (!ticketId.match(/^\d+$/)) {
    error(`Invalid ticket ID: ${ticketId}`);
    process.exit(1);
  }

  if (!noteContent.trim()) {
    error("Note content cannot be empty");
    process.exit(1);
  }

  const visibility = flags.public ? "public" : "internal";
  log(
    `${colors.cyan}Adding ${visibility} note to ticket #${ticketId}...${colors.reset}`,
    flags.quiet
  );

  const response = await addNote(ticketId, noteContent, flags.public);

  if (flags.json) {
    console.log(JSON.stringify(response, null, 2));
  } else {
    if (response.success) {
      console.log(`${colors.green}✓ Note added to ticket #${ticketId}${colors.reset}`);
      console.log(`  Type: ${visibility}`);
      if (response.note_id) {
        console.log(`  Note ID: ${response.note_id}`);
      }
      console.log(`  Time: ${response.timestamp || new Date().toISOString()}`);
      console.log(`  Content: ${noteContent.slice(0, 50)}${noteContent.length > 50 ? "..." : ""}`);
    } else {
      error(`Failed to add note: ${response.error}`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
