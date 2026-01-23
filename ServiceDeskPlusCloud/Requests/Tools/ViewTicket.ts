#!/usr/bin/env bun
/**
 * ============================================================================
 * VIEWTICKET - Fetch a single SDP ticket by display ID
 * ============================================================================
 *
 * PURPOSE:
 * Retrieves a specific ticket from ServiceDesk Plus by display_id,
 * shows status/assignment info, and offers to pick up if unassigned.
 *
 * USAGE:
 *   bun ViewTicket.ts 42376              # View ticket #42376
 *   bun ViewTicket.ts 42376 --json       # Output as JSON
 *   bun ViewTicket.ts 42376 --pickup     # View and pick up ticket
 *   bun ViewTicket.ts --help             # Show this help
 *
 * OPTIONS:
 *   --json          Output as JSON instead of markdown
 *   --pickup        Automatically pick up the ticket if unassigned
 *   --quiet         Minimal output for scripting
 *   --help          Show this help
 *
 * OUTPUT:
 *   Returns ticket details with assignment status.
 *   If ticket is unassigned or assigned to someone else,
 *   outputs a prompt suggestion for pickup.
 *
 * BACKEND: Uses auth-keeper sdp via subscription-based CLI
 *
 * ============================================================================
 */

import { spawnSync } from "child_process";

const AUTH_KEEPER_PATH = "~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh";
const DEFAULT_TECHNICIAN_EMAIL = "sfoley@buxtonco.com";

interface TicketDetails {
  id: string;
  display_id: string;
  subject: string;
  description?: string;
  status: {
    name: string;
    in_progress: boolean;
    internal_name: string;
  };
  priority?: { name: string };
  due_by_time?: { display_value: string; value: string };
  created_time: { display_value: string; value: string };
  last_updated_time?: { display_value: string; value: string };
  assigned_time?: { display_value: string; value: string };
  requester?: {
    name: string;
    email_id: string;
    is_vip_user?: boolean;
    department?: { name: string };
    job_title?: string;
  };
  technician?: {
    name: string;
    email_id: string;
  };
  category?: { name: string };
  subcategory?: { name: string };
  email_cc?: string[];
}

interface ApiResponse {
  request?: TicketDetails;
  requests?: TicketDetails[];
  response_status?: {
    status_code: number;
    status: string;
    messages?: Array<{ message: string }>;
  };
  pickup_request?: TicketDetails;
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
 * Call SDP API via auth-keeper
 */
function callSdpApi(method: string, endpoint: string, inputData?: object): ApiResponse {
  let command: string;

  if (method === "GET" && inputData) {
    const json = JSON.stringify(inputData).replace(/'/g, "'\\''");
    command = `source ${AUTH_KEEPER_PATH} && _ak_sdp_api "${method}" "${endpoint}" --data-urlencode 'input_data=${json}'`;
  } else if (method !== "GET" && inputData) {
    const json = JSON.stringify(inputData).replace(/'/g, "'\\''");
    command = `source ${AUTH_KEEPER_PATH} && _ak_sdp_api "${method}" "${endpoint}" -d 'input_data=${json}'`;
  } else {
    command = `source ${AUTH_KEEPER_PATH} && _ak_sdp_api "${method}" "${endpoint}"`;
  }

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
 * Fetch ticket by display_id
 */
async function fetchTicketByDisplayId(displayId: string): Promise<TicketDetails | null> {
  const inputData = {
    list_info: {
      row_count: 1,
      search_criteria: [
        { field: "display_id", condition: "is", value: displayId }
      ]
    }
  };

  const response = callSdpApi("GET", "/api/v3/requests", inputData);

  if (response.response_status?.status === "failed") {
    const msg = response.response_status.messages?.[0]?.message || "Unknown error";
    throw new Error(`SDP API error: ${msg}`);
  }

  const tickets = response.requests || [];
  if (tickets.length === 0) {
    return null;
  }

  // Now fetch full details using the internal ID
  const internalId = tickets[0].id;
  const detailResponse = callSdpApi("GET", `/api/v3/requests/${internalId}`);

  if (detailResponse.response_status?.status === "failed") {
    const msg = detailResponse.response_status.messages?.[0]?.message || "Unknown error";
    throw new Error(`SDP API error: ${msg}`);
  }

  return detailResponse.request || null;
}

/**
 * Pick up a ticket (assign to self)
 */
async function pickupTicket(internalId: string): Promise<TicketDetails | null> {
  const response = callSdpApi("PUT", `/api/v3/requests/${internalId}/pickup`);

  if (response.response_status?.status === "failed") {
    const msg = response.response_status.messages?.[0]?.message || "Unknown error";
    throw new Error(`Pickup failed: ${msg}`);
  }

  return response.pickup_request || null;
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Format ticket as markdown
 */
function formatMarkdown(ticket: TicketDetails, technicianEmail: string): string {
  const isAssignedToMe = ticket.technician?.email_id === technicianEmail;
  const isUnassigned = !ticket.technician;
  const isInProgress = ticket.status?.in_progress === true;

  let output = `# Ticket #${ticket.display_id}\n\n`;
  output += `**${ticket.subject}**\n\n`;

  // Status section
  output += `## Status\n`;
  output += `| Field | Value |\n`;
  output += `|-------|-------|\n`;
  output += `| Status | ${ticket.status?.name || "Unknown"}${isInProgress ? " (In Progress)" : ""} |\n`;
  output += `| Priority | ${ticket.priority?.name || "Normal"} |\n`;
  output += `| Category | ${ticket.category?.name || "N/A"} → ${ticket.subcategory?.name || "N/A"} |\n`;

  // Assignment status with visual indicators
  if (isUnassigned) {
    output += `| Technician | ${colors.yellow}⚠️ UNASSIGNED${colors.reset} |\n`;
  } else if (isAssignedToMe) {
    output += `| Technician | ${colors.green}✅ ${ticket.technician!.name} (You)${colors.reset} |\n`;
  } else {
    output += `| Technician | ${ticket.technician!.name} |\n`;
  }

  output += `| Due | ${ticket.due_by_time?.display_value || "No due date"} |\n`;
  output += `| Created | ${ticket.created_time?.display_value || "Unknown"} |\n`;
  if (ticket.assigned_time) {
    output += `| Assigned | ${ticket.assigned_time.display_value} |\n`;
  }
  output += `\n`;

  // Requester section
  output += `## Requester\n`;
  output += `| Field | Value |\n`;
  output += `|-------|-------|\n`;
  output += `| Name | ${ticket.requester?.name || "Unknown"}${ticket.requester?.is_vip_user ? " ⭐ VIP" : ""} |\n`;
  output += `| Email | ${ticket.requester?.email_id || "N/A"} |\n`;
  output += `| Department | ${ticket.requester?.department?.name || "N/A"} |\n`;
  output += `| Title | ${ticket.requester?.job_title || "N/A"} |\n`;
  if (ticket.email_cc && ticket.email_cc.length > 0) {
    output += `| CC | ${ticket.email_cc.join(", ")} |\n`;
  }
  output += `\n`;

  // Description
  if (ticket.description) {
    output += `## Description\n\n`;
    output += stripHtml(ticket.description);
    output += `\n\n`;
  }

  // Pickup prompt
  if (isUnassigned || !isAssignedToMe) {
    output += `---\n\n`;
    output += `## 🎯 Action Required\n\n`;
    if (isUnassigned) {
      output += `This ticket is **unassigned**. Would you like to pick it up?\n\n`;
    } else {
      output += `This ticket is assigned to **${ticket.technician!.name}**.\n\n`;
    }
    output += `To pick up this ticket, run:\n`;
    output += `\`\`\`bash\n`;
    output += `bun ViewTicket.ts ${ticket.display_id} --pickup\n`;
    output += `\`\`\`\n\n`;
    output += `Or ask: "assign ticket ${ticket.display_id} to me"\n`;
  }

  return output;
}

/**
 * Format output for AskUserQuestion prompt integration
 */
function formatPromptInfo(ticket: TicketDetails, technicianEmail: string): object {
  const isAssignedToMe = ticket.technician?.email_id === technicianEmail;
  const isUnassigned = !ticket.technician;
  const isInProgress = ticket.status?.in_progress === true;

  return {
    ticket_id: ticket.display_id,
    internal_id: ticket.id,
    subject: ticket.subject,
    status: ticket.status?.name,
    in_progress: isInProgress,
    priority: ticket.priority?.name || "Normal",
    technician: ticket.technician?.name || null,
    technician_email: ticket.technician?.email_id || null,
    is_assigned_to_me: isAssignedToMe,
    is_unassigned: isUnassigned,
    requires_pickup: isUnassigned || !isAssignedToMe,
    requester: ticket.requester?.name,
    requester_email: ticket.requester?.email_id,
    due_date: ticket.due_by_time?.display_value || null,
    description: ticket.description ? stripHtml(ticket.description) : null,
    pickup_suggestion: isUnassigned || !isAssignedToMe
      ? `Ticket is ${isUnassigned ? "unassigned" : `assigned to ${ticket.technician!.name}`}. Prompt user if they want to pick it up.`
      : null,
  };
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  const flags = {
    json: args.includes("--json"),
    quiet: args.includes("--quiet"),
    pickup: args.includes("--pickup"),
    help: args.includes("--help") || args.includes("-h"),
  };

  // Extract ticket ID (first non-flag argument)
  const ticketId = args.find(arg => !arg.startsWith("--") && !arg.startsWith("-"));

  if (flags.help || !ticketId) {
    console.log(`
${colors.bold}ViewTicket - View SDP Ticket Details${colors.reset}

${colors.cyan}Usage:${colors.reset}
  bun ViewTicket.ts <ticket_id> [options]

${colors.cyan}Arguments:${colors.reset}
  ticket_id       The display ID of the ticket (e.g., 42376)

${colors.cyan}Options:${colors.reset}
  --json          Output as JSON (includes pickup prompt info)
  --pickup        Pick up the ticket (assign to self)
  --quiet         Minimal output
  --help          Show this help

${colors.cyan}Examples:${colors.reset}
  bun ViewTicket.ts 42376              # View ticket details
  bun ViewTicket.ts 42376 --json       # JSON output for AI processing
  bun ViewTicket.ts 42376 --pickup     # View and pick up ticket
`);
    process.exit(flags.help ? 0 : 1);
  }

  log(`${colors.cyan}Fetching ticket #${ticketId}...${colors.reset}`, flags.quiet);

  let ticket: TicketDetails | null;
  try {
    ticket = await fetchTicketByDisplayId(ticketId);
  } catch (e) {
    error(`Failed to fetch ticket: ${e}`);
    process.exit(1);
  }

  if (!ticket) {
    error(`Ticket #${ticketId} not found`);
    process.exit(1);
  }

  // Handle pickup if requested
  if (flags.pickup) {
    const isAssignedToMe = ticket.technician?.email_id === DEFAULT_TECHNICIAN_EMAIL;

    if (isAssignedToMe) {
      log(`${colors.green}Ticket is already assigned to you.${colors.reset}`, flags.quiet);
    } else {
      log(`${colors.cyan}Picking up ticket...${colors.reset}`, flags.quiet);
      try {
        ticket = await pickupTicket(ticket.id);
        if (ticket) {
          log(`${colors.green}✅ Ticket picked up successfully!${colors.reset}`, flags.quiet);
        }
      } catch (e) {
        error(`Failed to pick up ticket: ${e}`);
        process.exit(1);
      }
    }
  }

  if (!ticket) {
    error(`Failed to retrieve ticket details`);
    process.exit(1);
  }

  if (flags.json) {
    console.log(JSON.stringify(formatPromptInfo(ticket, DEFAULT_TECHNICIAN_EMAIL), null, 2));
  } else {
    console.log(formatMarkdown(ticket, DEFAULT_TECHNICIAN_EMAIL));
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
