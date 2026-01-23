#!/usr/bin/env bun
/**
 * ServiceDesk Plus API Client - SDP Cloud API for tickets and tasks
 *
 * This module provides deterministic functions for accessing ServiceDesk Plus
 * via the REST API. Authentication is handled through auth-keeper.sh.
 *
 * Usage:
 *   import { getMyTickets, getMyTasks, getTicketById } from './_shared/api/sdp';
 *
 * @author PAI System
 * @version 1.0.0
 */

import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import type {
  Item,
  ContextMessage,
  SyncOptions,
  SyncResult,
  SyncError,
  SourceAdapter,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

const AUTH_KEEPER_PATH = join(
  homedir(),
  "repos/github.com/sethdf/imladris/scripts/auth-keeper.sh"
);

const DEFAULT_TECHNICIAN_EMAIL = "sfoley@buxtonco.com";

// =============================================================================
// Raw SDP API Types
// =============================================================================

interface SdpRequester {
  id: string;
  name: string;
  email_id: string;
  is_vipuser?: boolean;
  department?: { id: string; name: string };
}

interface SdpTechnician {
  id: string;
  name: string;
  email_id: string;
}

interface SdpStatus {
  id: string;
  name: string;
  in_progress?: boolean;
}

interface SdpPriority {
  id: string;
  name: string;
}

interface SdpTimeValue {
  display_value: string;
  value: string; // Unix timestamp as string
}

interface SdpTicket {
  id: string;
  subject: string;
  status: SdpStatus;
  priority?: SdpPriority;
  due_by_time?: SdpTimeValue;
  created_time: SdpTimeValue;
  last_updated_time?: SdpTimeValue;
  requester?: SdpRequester;
  technician?: SdpTechnician;
  description?: string;
  resolution?: { content?: string };
  category?: { name: string };
  subcategory?: { name: string };
  item?: { name: string };
}

interface SdpTask {
  id: string;
  title: string;
  status: SdpStatus;
  priority?: SdpPriority;
  due_date?: SdpTimeValue;
  created_time: SdpTimeValue;
  completed_time?: SdpTimeValue;
  owner?: SdpTechnician;
  description?: string;
  scheduled_start_time?: SdpTimeValue;
  scheduled_end_time?: SdpTimeValue;
  percentage_completion?: number;
}

interface SdpApiResponse<T> {
  requests?: T[];
  tasks?: T[];
  request?: T;
  task?: T;
  response_status?: Array<{
    status_code: number;
    status: string;
    messages?: Array<{ message: string }>;
  }>;
}

interface SdpNote {
  id: string;
  description: string;
  created_time: SdpTimeValue;
  created_by?: { name: string; email_id: string };
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Call SDP API via auth-keeper
 */
async function callSdpApi<T>(
  method: string,
  endpoint: string,
  inputData?: object
): Promise<SdpApiResponse<T>> {
  let command: string;

  if (method === "GET" && inputData) {
    const json = JSON.stringify(inputData);
    command = `
source ${AUTH_KEEPER_PATH}
_ak_sdp_api "${method}" "${endpoint}" --data-urlencode 'input_data=${json.replace(/'/g, "'\\''")}'
`.trim();
  } else if (method !== "GET" && inputData) {
    const json = JSON.stringify(inputData);
    command = `
source ${AUTH_KEEPER_PATH}
_ak_sdp_api "${method}" "${endpoint}" -d 'input_data=${json.replace(/'/g, "'\\''")}'
`.trim();
  } else {
    command = `
source ${AUTH_KEEPER_PATH}
_ak_sdp_api "${method}" "${endpoint}"
`.trim();
  }

  try {
    const result = await $`bash -c ${command}`.text();
    return JSON.parse(result);
  } catch (e) {
    return {
      response_status: [
        {
          status_code: 500,
          status: "failed",
          messages: [{ message: e instanceof Error ? e.message : String(e) }],
        },
      ],
    };
  }
}

/**
 * Get tickets assigned to the current technician
 */
export async function getMyTickets(
  limit: number = 50,
  technicianEmail: string = DEFAULT_TECHNICIAN_EMAIL
): Promise<SdpTicket[]> {
  // Technician filter first, then AND with in_progress status
  // status.in_progress=true captures Open, In Progress, On Hold (excludes Closed, Canceled)
  const inputData = {
    list_info: {
      row_count: limit,
      start_index: 1,
      sort_field: "due_by_time",
      sort_order: "asc",
      get_total_count: true,
      search_criteria: [
        { field: "technician.email_id", condition: "is", value: technicianEmail },
        { field: "status.in_progress", condition: "is", logical_operator: "AND", value: true },
      ],
    },
  };

  const response = await callSdpApi<SdpTicket>("GET", "/api/v3/requests", inputData);

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP getMyTickets error: ${msg}`);
    return [];
  }

  return response.requests || [];
}

/**
 * Get all open/in-progress tickets (no technician filter)
 */
export async function getOpenTickets(limit: number = 100): Promise<SdpTicket[]> {
  const inputData = {
    list_info: {
      row_count: limit,
      start_index: 1,
      sort_field: "due_by_time",
      sort_order: "asc",
      get_total_count: true,
      search_criteria: [
        { field: "status.in_progress", condition: "is", logical_operator: "OR", value: true },
        { field: "status.name", condition: "is", value: "Open" },
      ],
    },
  };

  const response = await callSdpApi<SdpTicket>("GET", "/api/v3/requests", inputData);

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP getOpenTickets error: ${msg}`);
    return [];
  }

  return response.requests || [];
}

/**
 * Get ticket by ID with full details
 */
export async function getTicketById(ticketId: string): Promise<SdpTicket | null> {
  const response = await callSdpApi<SdpTicket>("GET", `/api/v3/requests/${ticketId}`);

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP getTicketById error: ${msg}`);
    return null;
  }

  return response.request || null;
}

/**
 * Get tasks assigned to the current technician
 */
export async function getMyTasks(
  limit: number = 50,
  ownerEmail: string = DEFAULT_TECHNICIAN_EMAIL
): Promise<SdpTask[]> {
  const inputData = {
    list_info: {
      row_count: limit,
      start_index: 1,
      sort_field: "due_date",
      sort_order: "asc",
      get_total_count: true,
      search_criteria: [
        { field: "owner.email_id", condition: "is", value: ownerEmail },
        { field: "status.name", condition: "is not", value: "Completed" },
        { field: "status.name", condition: "is not", value: "Cancelled" },
      ],
    },
  };

  const response = await callSdpApi<SdpTask>("GET", "/api/v3/tasks", inputData);

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP getMyTasks error: ${msg}`);
    return [];
  }

  return response.tasks || [];
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: string): Promise<SdpTask | null> {
  const response = await callSdpApi<SdpTask>("GET", `/api/v3/tasks/${taskId}`);

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP getTaskById error: ${msg}`);
    return null;
  }

  return response.task || null;
}

/**
 * Get notes for a ticket (for thread context)
 */
export async function getTicketNotes(ticketId: string): Promise<SdpNote[]> {
  const inputData = {
    list_info: {
      row_count: 20,
      sort_field: "created_time",
      sort_order: "desc",
    },
  };

  const response = await callSdpApi<SdpNote>("GET", `/api/v3/requests/${ticketId}/notes`, inputData);

  return (response as any).notes || [];
}

/**
 * Add a note to a ticket
 */
export async function addTicketNote(
  ticketId: string,
  note: string,
  isPublic: boolean = false
): Promise<boolean> {
  const inputData = {
    request_note: {
      description: note,
      show_to_requester: isPublic,
    },
  };

  const response = await callSdpApi<any>(
    "POST",
    `/api/v3/requests/${ticketId}/notes`,
    inputData
  );

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP addTicketNote error: ${msg}`);
    return false;
  }

  return true;
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  statusName: string
): Promise<boolean> {
  const inputData = {
    request: {
      status: { name: statusName },
    },
  };

  const response = await callSdpApi<any>(
    "PUT",
    `/api/v3/requests/${ticketId}`,
    inputData
  );

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP updateTicketStatus error: ${msg}`);
    return false;
  }

  return true;
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  statusName: string
): Promise<boolean> {
  const inputData = {
    task: {
      status: { name: statusName },
    },
  };

  const response = await callSdpApi<any>(
    "PUT",
    `/api/v3/tasks/${taskId}`,
    inputData
  );

  if (response.response_status?.[0]?.status === "failed") {
    const msg = response.response_status[0].messages?.[0]?.message || "Unknown error";
    console.error(`SDP updateTaskStatus error: ${msg}`);
    return false;
  }

  return true;
}

/**
 * Health check - verify SDP connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const inputData = { list_info: { row_count: 1 } };
    const response = await callSdpApi<SdpTicket>("GET", "/api/v3/requests", inputData);
    return !response.response_status?.[0]?.status?.includes("failed");
  } catch {
    return false;
  }
}

// =============================================================================
// Normalized Item Conversion
// =============================================================================

/**
 * Convert SDP ticket to normalized Item format
 */
export function normalizeTicket(ticket: SdpTicket): Item {
  const id = `sdp-ticket:${ticket.id}`;
  const timestamp = ticket.created_time?.value
    ? new Date(parseInt(ticket.created_time.value))
    : new Date();

  return {
    id,
    source: "sdp-ticket",
    sourceId: ticket.id,
    itemType: "ticket",
    timestamp,
    from: {
      name: ticket.requester?.name || null,
      address: ticket.requester?.email_id || null,
      userId: ticket.requester?.id || null,
    },
    subject: ticket.subject,
    body: ticket.description || null,
    bodyPreview: ticket.subject?.substring(0, 200) || null,
    threadId: ticket.id, // Tickets are their own threads
    threadContext: null,
    metadata: {
      status: ticket.status?.name,
      priority: ticket.priority?.name,
      technician: ticket.technician?.name,
      technicianEmail: ticket.technician?.email_id,
      dueByTime: ticket.due_by_time?.value,
      dueByDisplay: ticket.due_by_time?.display_value,
      isVip: ticket.requester?.is_vipuser || false,
      department: ticket.requester?.department?.name,
      category: ticket.category?.name,
      subcategory: ticket.subcategory?.name,
      item: ticket.item?.name,
    },
    readStatus: "unread", // SDP doesn't track "read" status for agents
    createdAt: new Date(),
    updatedAt: ticket.last_updated_time?.value
      ? new Date(parseInt(ticket.last_updated_time.value))
      : new Date(),
  };
}

/**
 * Convert SDP task to normalized Item format
 */
export function normalizeTask(task: SdpTask): Item {
  const id = `sdp-task:${task.id}`;
  const timestamp = task.created_time?.value
    ? new Date(parseInt(task.created_time.value))
    : new Date();

  return {
    id,
    source: "sdp-task",
    sourceId: task.id,
    itemType: "task",
    timestamp,
    from: {
      name: task.owner?.name || null,
      address: task.owner?.email_id || null,
      userId: task.owner?.id || null,
    },
    subject: task.title,
    body: task.description || null,
    bodyPreview: task.title?.substring(0, 200) || null,
    threadId: null, // Tasks don't have threads
    threadContext: null,
    metadata: {
      status: task.status?.name,
      priority: task.priority?.name,
      dueDate: task.due_date?.value,
      dueDateDisplay: task.due_date?.display_value,
      percentComplete: task.percentage_completion,
      scheduledStart: task.scheduled_start_time?.value,
      scheduledEnd: task.scheduled_end_time?.value,
    },
    readStatus: "unread",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// Source Adapter Implementations
// =============================================================================

/**
 * SDP Tickets Source Adapter for UnifiedInbox
 */
export const sdpTicketAdapter: SourceAdapter = {
  name: "sdp-ticket",
  rateLimitMs: 500, // Be conservative with SDP API

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    const itemsDeleted = 0;

    try {
      const limit = options?.limit || 100;
      // Only sync tickets assigned to me (sfoley@buxtonco.com)
      const tickets = await getMyTickets(limit, DEFAULT_TECHNICIAN_EMAIL);
      itemsProcessed = tickets.length;

      return {
        success: true,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: null, // SDP doesn't support delta sync
        duration: Date.now() - startTime,
        nextSyncRecommended: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };
    } catch (e) {
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        retryable: true,
        originalError: e,
      });

      return {
        success: false,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: null,
        duration: Date.now() - startTime,
        nextSyncRecommended: null,
      };
    }
  },

  async getItems(since?: Date): Promise<Item[]> {
    // Only get tickets assigned to me (sfoley@buxtonco.com)
    const tickets = await getMyTickets(100, DEFAULT_TECHNICIAN_EMAIL);

    let filtered = tickets;
    if (since) {
      filtered = tickets.filter((t) => {
        const created = t.created_time?.value
          ? new Date(parseInt(t.created_time.value))
          : new Date(0);
        return created > since;
      });
    }

    return filtered.map(normalizeTicket);
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(itemId: string): Promise<ContextMessage[]> {
    const ticketId = itemId.replace("sdp-ticket:", "");
    const notes = await getTicketNotes(ticketId);

    return notes.map((note) => ({
      timestamp: note.created_time?.value
        ? new Date(parseInt(note.created_time.value))
        : new Date(),
      from: {
        name: note.created_by?.name || null,
        address: note.created_by?.email_id || null,
        userId: null,
      },
      body: note.description || "",
    }));
  },
};

/**
 * SDP Tasks Source Adapter for UnifiedInbox
 */
export const sdpTaskAdapter: SourceAdapter = {
  name: "sdp-task",
  rateLimitMs: 500,

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    const itemsDeleted = 0;

    try {
      const limit = options?.limit || 100;
      const tasks = await getMyTasks(limit);
      itemsProcessed = tasks.length;

      return {
        success: true,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: null,
        duration: Date.now() - startTime,
        nextSyncRecommended: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };
    } catch (e) {
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        retryable: true,
        originalError: e,
      });

      return {
        success: false,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: null,
        duration: Date.now() - startTime,
        nextSyncRecommended: null,
      };
    }
  },

  async getItems(since?: Date): Promise<Item[]> {
    const tasks = await getMyTasks(100);

    let filtered = tasks;
    if (since) {
      filtered = tasks.filter((t) => {
        const created = t.created_time?.value
          ? new Date(parseInt(t.created_time.value))
          : new Date(0);
        return created > since;
      });
    }

    return filtered.map(normalizeTask);
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(_itemId: string): Promise<ContextMessage[]> {
    // Tasks don't have thread context
    return [];
  },
};

// =============================================================================
// CLI for Testing
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "health":
      const healthy = await healthCheck();
      console.log(healthy ? "SDP connection OK" : "SDP connection FAILED");
      process.exit(healthy ? 0 : 1);
      break;

    case "my-tickets":
    case "tickets":
      const ticketLimit = parseInt(args[1]) || 20;
      const tickets = await getMyTickets(ticketLimit);
      console.log(JSON.stringify(tickets, null, 2));
      break;

    case "open-tickets":
      const openLimit = parseInt(args[1]) || 20;
      const openTickets = await getOpenTickets(openLimit);
      console.log(JSON.stringify(openTickets, null, 2));
      break;

    case "ticket":
      const ticketId = args[1];
      if (!ticketId) {
        console.error("Usage: sdp.ts ticket <ticketId>");
        process.exit(1);
      }
      const ticket = await getTicketById(ticketId);
      console.log(JSON.stringify(ticket, null, 2));
      break;

    case "my-tasks":
    case "tasks":
      const taskLimit = parseInt(args[1]) || 20;
      const tasks = await getMyTasks(taskLimit);
      console.log(JSON.stringify(tasks, null, 2));
      break;

    case "task":
      const taskId = args[1];
      if (!taskId) {
        console.error("Usage: sdp.ts task <taskId>");
        process.exit(1);
      }
      const task = await getTaskById(taskId);
      console.log(JSON.stringify(task, null, 2));
      break;

    case "notes":
      const notesTicketId = args[1];
      if (!notesTicketId) {
        console.error("Usage: sdp.ts notes <ticketId>");
        process.exit(1);
      }
      const notes = await getTicketNotes(notesTicketId);
      console.log(JSON.stringify(notes, null, 2));
      break;

    case "normalize-tickets":
      const normTicketLimit = parseInt(args[1]) || 5;
      const rawTickets = await getMyTickets(normTicketLimit);
      const normalizedTickets = rawTickets.map(normalizeTicket);
      console.log(JSON.stringify(normalizedTickets, null, 2));
      break;

    case "normalize-tasks":
      const normTaskLimit = parseInt(args[1]) || 5;
      const rawTasks = await getMyTasks(normTaskLimit);
      const normalizedTasks = rawTasks.map(normalizeTask);
      console.log(JSON.stringify(normalizedTasks, null, 2));
      break;

    case "sync-tickets":
      const ticketSyncResult = await sdpTicketAdapter.sync({});
      console.log(JSON.stringify(ticketSyncResult, null, 2));
      break;

    case "sync-tasks":
      const taskSyncResult = await sdpTaskAdapter.sync({});
      console.log(JSON.stringify(taskSyncResult, null, 2));
      break;

    default:
      console.log(`
ServiceDesk Plus API Client - Test CLI

Usage:
  bun sdp.ts health                Check SDP connection
  bun sdp.ts my-tickets [limit]    Get my assigned tickets
  bun sdp.ts open-tickets [limit]  Get all open tickets
  bun sdp.ts ticket <id>           Get ticket by ID
  bun sdp.ts my-tasks [limit]      Get my assigned tasks
  bun sdp.ts task <id>             Get task by ID
  bun sdp.ts notes <ticketId>      Get ticket notes
  bun sdp.ts normalize-tickets [n] Get normalized ticket items
  bun sdp.ts normalize-tasks [n]   Get normalized task items
  bun sdp.ts sync-tickets          Run ticket sync operation
  bun sdp.ts sync-tasks            Run task sync operation
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
