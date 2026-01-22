#!/usr/bin/env bun
/**
 * SDP API - ServiceDesk Plus API wrapper
 *
 * Fetches tickets from ServiceDesk Plus using OAuth or API key authentication.
 * Credentials stored in BWS.
 */

import { spawnSync } from "child_process";

interface SdpConfig {
  baseUrl: string;
  accessToken?: string;
  apiKey?: string;
  technicianId?: string;
}

interface SdpTicket {
  id: string;
  subject: string;
  status: { name: string };
  priority?: { name: string };
  due_by_time?: { display_value: string; value: string };
  created_time: { display_value: string; value: string };
  last_updated_time?: { display_value: string; value: string };
  requester?: {
    name: string;
    email_id: string;
    is_vipuser?: boolean;
    department?: { name: string };
  };
  technician?: { name: string; email_id: string };
}

/**
 * Get secret from BWS
 */
function getBwsSecret(key: string): string | null {
  const result = spawnSync("bws", ["secret", "get", key, "--output", "json"], {
    encoding: "utf-8",
    timeout: 10000,
  });

  if (result.status !== 0) {
    return null;
  }

  try {
    const data = JSON.parse(result.stdout);
    return data.value || null;
  } catch {
    return null;
  }
}

/**
 * Refresh OAuth access token using refresh token
 */
async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const tokenUrl = "https://accounts.zoho.com/oauth/v2/token";

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { access_token?: string; error?: string };

  if (data.error) {
    throw new Error(`Token refresh error: ${data.error}`);
  }

  if (!data.access_token) {
    throw new Error("No access token in response");
  }

  return data.access_token;
}

/**
 * Load SDP configuration from BWS
 */
async function loadConfig(): Promise<SdpConfig> {
  const baseUrl = getBwsSecret("sdp-base-url");
  if (!baseUrl) {
    throw new Error("sdp-base-url not found in BWS");
  }

  // Try OAuth first
  const clientId = getBwsSecret("sdp-client-id");
  const clientSecret = getBwsSecret("sdp-client-secret");
  const refreshToken = getBwsSecret("sdp-refresh-token");

  if (clientId && clientSecret && refreshToken) {
    console.error("Using OAuth authentication...");
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    return {
      baseUrl: baseUrl.replace(/\/app\/itdesk\/?$/, ""),
      accessToken,
      technicianId: getBwsSecret("sdp-technician-id") || undefined,
    };
  }

  // Fall back to API key
  const apiKey = getBwsSecret("sdp-api-key");
  if (apiKey) {
    console.error("Using API key authentication...");
    return {
      baseUrl: baseUrl.replace(/\/app\/itdesk\/?$/, ""),
      apiKey,
      technicianId: getBwsSecret("sdp-technician-id") || undefined,
    };
  }

  throw new Error("No SDP authentication configured (need OAuth or API key)");
}

/**
 * Fetch tickets assigned to technician
 */
async function fetchMyTickets(config: SdpConfig, limit: number = 50): Promise<SdpTicket[]> {
  // Build search criteria
  const searchCriteria: Record<string, unknown>[] = [
    { field: "status.in_progress", condition: "is", logical_operator: "OR", value: true },
    { field: "status.name", condition: "is", value: "Open" },
  ];

  // Add technician filter if we have the ID
  if (config.technicianId) {
    searchCriteria.push({
      field: "technician.id",
      condition: "is",
      value: config.technicianId,
    });
  }

  const inputData = {
    list_info: {
      row_count: limit,
      start_index: 1,
      sort_field: "due_by_time",
      sort_order: "asc",
      get_total_count: true,
      search_criteria: searchCriteria,
    },
  };

  const url = `${config.baseUrl}/api/v3/requests?input_data=${encodeURIComponent(JSON.stringify(inputData))}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (config.accessToken) {
    headers["Authorization"] = `Zoho-oauthtoken ${config.accessToken}`;
  } else if (config.apiKey) {
    headers["authtoken"] = config.apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SDP API error: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    requests?: SdpTicket[];
    response_status?: { status: string; messages?: Array<{ message: string }> };
  };

  if (data.response_status?.status === "failed") {
    const msg = data.response_status.messages?.[0]?.message || "Unknown error";
    throw new Error(`SDP API failed: ${msg}`);
  }

  return data.requests || [];
}

/**
 * Transform SDP ticket to normalized format
 */
function normalizeTicket(ticket: SdpTicket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status?.name || "Unknown",
    priority: ticket.priority?.name || "Medium",
    due_by_time: ticket.due_by_time?.value || null,
    created_time: ticket.created_time?.value || new Date().toISOString(),
    last_updated_time: ticket.last_updated_time?.value || ticket.created_time?.value,
    requester: ticket.requester ? {
      name: ticket.requester.name,
      email: ticket.requester.email_id,
      is_vip: ticket.requester.is_vipuser || false,
      department: ticket.requester.department?.name || "Unknown",
    } : undefined,
    technician: ticket.technician ? {
      name: ticket.technician.name,
      email: ticket.technician.email_id,
    } : undefined,
  };
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "list";

  try {
    const config = await loadConfig();

    switch (command) {
      case "list":
      case "my-tickets": {
        const limit = parseInt(args[1] || "50", 10);
        const tickets = await fetchMyTickets(config, limit);
        const normalized = tickets.map(normalizeTicket);
        console.log(JSON.stringify(normalized, null, 2));
        break;
      }

      case "auth":
        console.log("Authentication successful");
        console.log(`Base URL: ${config.baseUrl}`);
        console.log(`Auth type: ${config.accessToken ? "OAuth" : "API Key"}`);
        break;

      case "help":
        console.log(`
SDP API Tool

Usage:
  bun SdpApi.ts [command]

Commands:
  list [limit]      List my assigned tickets (default: 50)
  my-tickets        Alias for list
  auth              Test authentication
  help              Show this help
`);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
