#!/usr/bin/env bun
/**
 * ============================================================================
 * ADDNOTE - Add an internal note to an SDP ticket
 * ============================================================================
 *
 * PURPOSE:
 * Adds an internal note to a ServiceDesk Plus ticket by display_id.
 * Notes can be private (technician only) or public (visible to requester).
 *
 * USAGE:
 *   bun AddNote.ts 42376 "Note content here"
 *   bun AddNote.ts 42376 "Note content" --public
 *   bun AddNote.ts --help
 *
 * OPTIONS:
 *   --public        Make note visible to requester (default: private)
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * BACKEND: Uses auth-keeper sdp via subscription-based CLI
 *
 * ============================================================================
 */

import { spawnSync } from "child_process";

const AUTH_KEEPER_PATH = "~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh";

interface ApiResponse {
  request_note?: {
    id: string;
    description: string;
    created_time: { display_value: string };
    created_by?: { name: string };
  };
  response_status?: {
    status_code: number;
    status: string;
    messages?: Array<{ message: string; status_code?: number }>;
  };
}

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(msg: string, quiet: boolean = false) {
  if (!quiet) console.log(msg);
}

function error(msg: string) {
  console.error(`${colors.red}Error: ${msg}${colors.reset}`);
}

/**
 * Fetch ticket internal ID by display_id
 */
function getInternalId(displayId: string): string | null {
  const inputData = {
    list_info: {
      row_count: 1,
      search_criteria: [
        { field: "display_id", condition: "is", value: displayId }
      ]
    }
  };

  const json = JSON.stringify(inputData).replace(/'/g, "'\\''");
  const command = `source ${AUTH_KEEPER_PATH} && _ak_sdp_api "GET" "/api/v3/requests" --data-urlencode 'input_data=${json}'`;

  const result = spawnSync("bash", ["-c", `ZONE=work ${command}`], {
    encoding: "utf-8",
    timeout: 30000,
  });

  if (result.status !== 0) {
    return null;
  }

  try {
    const response = JSON.parse(result.stdout.trim());
    const tickets = response.requests || [];
    return tickets.length > 0 ? tickets[0].id : null;
  } catch {
    return null;
  }
}

/**
 * Add note to ticket via SDP API
 */
function addNote(internalId: string, note: string, isPublic: boolean): ApiResponse {
  const inputData = {
    request_note: {
      description: note,
      show_to_requester: isPublic,
    },
  };

  const json = JSON.stringify(inputData).replace(/'/g, "'\\''");

  // Must use --data-urlencode for proper encoding
  const command = `
source ${AUTH_KEEPER_PATH}
_ak_sdp_get_creds
base_url="\${_ak_sdp_base_url%/app/itdesk*}"
curl -s -X POST "\${base_url}/api/v3/requests/${internalId}/notes" \
    -H "Authorization: Zoho-oauthtoken \$_ak_sdp_token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Accept: application/vnd.manageengine.sdp.v3+json" \
    --data-urlencode 'input_data=${json}'
`.trim();

  const result = spawnSync("bash", ["-c", `ZONE=work ${command}`], {
    encoding: "utf-8",
    timeout: 30000,
  });

  if (result.status !== 0 && result.stderr) {
    throw new Error(`API call failed: ${result.stderr}`);
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`Failed to parse API response: ${result.stdout}`);
  }
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  const flags = {
    public: args.includes("--public"),
    quiet: args.includes("--quiet"),
    help: args.includes("--help") || args.includes("-h"),
  };

  // Filter out flags to get positional args
  const positionalArgs = args.filter(arg => !arg.startsWith("--") && !arg.startsWith("-"));
  const ticketId = positionalArgs[0];
  const noteContent = positionalArgs.slice(1).join(" ");

  if (flags.help || !ticketId || !noteContent) {
    console.log(`
${colors.bold}AddNote - Add Note to SDP Ticket${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun AddNote.ts <ticket_id> <note_content> [options]

${colors.cyan}Arguments:${colors.reset}
  ticket_id       The display ID of the ticket (e.g., 42376)
  note_content    The note text to add (can be quoted or multiple words)

${colors.cyan}Options:${colors.reset}
  --public        Make note visible to requester (default: private/internal)
  --quiet         Minimal output
  --help          Show this help

${colors.cyan}Examples:${colors.reset}
  bun AddNote.ts 42376 "Investigation complete - root cause identified"
  bun AddNote.ts 42376 Updated firewall rules for access --public
  bun AddNote.ts 42376 "Work completed:\\n- Item 1\\n- Item 2"
`);
    process.exit(flags.help ? 0 : 1);
  }

  log(`${colors.cyan}Looking up ticket #${ticketId}...${colors.reset}`, flags.quiet);

  const internalId = getInternalId(ticketId);
  if (!internalId) {
    error(`Ticket #${ticketId} not found`);
    process.exit(1);
  }

  log(`${colors.cyan}Adding note to ticket #${ticketId}...${colors.reset}`, flags.quiet);

  let response: ApiResponse;
  try {
    response = addNote(internalId, noteContent, flags.public);
  } catch (e) {
    error(`Failed to add note: ${e}`);
    process.exit(1);
  }

  if (response.response_status?.status === "failed") {
    const msg = response.response_status.messages?.[0]?.message || "Unknown error";
    error(`API error: ${msg}`);
    process.exit(1);
  }

  if (response.request_note) {
    const note = response.request_note;
    log(`
${colors.green}✅ Note added successfully${colors.reset}

${colors.bold}Ticket:${colors.reset} #${ticketId}
${colors.bold}Note ID:${colors.reset} ${note.id}
${colors.bold}Created:${colors.reset} ${note.created_time?.display_value}
${colors.bold}Visibility:${colors.reset} ${flags.public ? "Public (visible to requester)" : "Private (technicians only)"}
${colors.bold}Content:${colors.reset}
${note.description}
`, flags.quiet);
  } else {
    log(`${colors.green}✅ Note added to ticket #${ticketId}${colors.reset}`, flags.quiet);
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
