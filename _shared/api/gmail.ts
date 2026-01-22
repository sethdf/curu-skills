#!/usr/bin/env bun
/**
 * Gmail API Client - Google Gmail API for email operations
 *
 * This module provides deterministic functions for accessing Gmail
 * via the Gmail API. Authentication is handled through auth-keeper.sh.
 *
 * Usage:
 *   import { getUnreadEmails, getEmailById, markEmailAsRead } from './_shared/api/gmail';
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

// =============================================================================
// Raw Gmail API Functions
// =============================================================================

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  historyId?: string;
  internalDate?: string;
  payload?: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number };
    }>;
  };
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHistoryResponse {
  history?: Array<{
    id: string;
    messages?: Array<{ id: string; threadId: string }>;
    messagesAdded?: Array<{ message: { id: string; threadId: string; labelIds: string[] } }>;
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>;
    labelsAdded?: Array<{ message: { id: string }; labelIds: string[] }>;
    labelsRemoved?: Array<{ message: { id: string }; labelIds: string[] }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
}

/**
 * Call Gmail API via auth-keeper
 */
async function callGmailApi(
  method: string,
  endpoint: string,
  body?: object
): Promise<any> {
  let command: string;

  if (body) {
    const bodyJson = JSON.stringify(body);
    command = `
source ${AUTH_KEEPER_PATH}
token=$(_ak_google_get_access_token) || exit 1
curl -s -X ${method} "https://www.googleapis.com/${endpoint}" \\
  -H "Authorization: Bearer $token" \\
  -H "Content-Type: application/json" \\
  -d '${bodyJson.replace(/'/g, "'\\''")}'
`.trim();
  } else {
    command = `
source ${AUTH_KEEPER_PATH}
token=$(_ak_google_get_access_token) || exit 1
curl -s -X ${method} "https://www.googleapis.com/${endpoint}" \\
  -H "Authorization: Bearer $token"
`.trim();
  }

  const result = await $`bash -c ${command}`.text();

  try {
    return JSON.parse(result);
  } catch (e) {
    // Return raw text if not JSON
    return result;
  }
}

/**
 * Get header value from Gmail message
 */
function getHeader(msg: GmailMessage, name: string): string | null {
  const header = msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || null;
}

/**
 * Parse email address from "Name <email@example.com>" format
 */
function parseEmailAddress(from: string | null): { name: string | null; address: string | null } {
  if (!from) return { name: null, address: null };

  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), address: match[2].trim() };
  }

  // Just an email address
  if (from.includes("@")) {
    return { name: null, address: from.trim() };
  }

  return { name: from.trim(), address: null };
}

/**
 * Get list of unread emails
 */
export async function getUnreadEmails(limit: number = 100): Promise<GmailMessage[]> {
  const response = await callGmailApi(
    "GET",
    `gmail/v1/users/me/messages?maxResults=${limit}&q=is:unread+in:inbox`
  ) as GmailListResponse;

  if (!response.messages || response.messages.length === 0) {
    return [];
  }

  // Get full message details for each
  const messages: GmailMessage[] = [];
  for (const msg of response.messages.slice(0, limit)) {
    const full = await getEmailById(msg.id);
    if (full) {
      messages.push(full);
    }
  }

  return messages;
}

/**
 * Get email by ID with full details
 */
export async function getEmailById(messageId: string): Promise<GmailMessage | null> {
  try {
    const response = await callGmailApi(
      "GET",
      `gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Message-ID`
    );

    if (response.error) {
      console.error(`Gmail API error: ${response.error.message}`);
      return null;
    }

    return response as GmailMessage;
  } catch (e) {
    console.error(`Failed to get email ${messageId}: ${e}`);
    return null;
  }
}

/**
 * Get email changes using history API (incremental sync)
 */
export async function getEmailHistory(
  startHistoryId: string,
  maxResults: number = 100
): Promise<GmailHistoryResponse> {
  const response = await callGmailApi(
    "GET",
    `gmail/v1/users/me/history?startHistoryId=${startHistoryId}&maxResults=${maxResults}&labelId=INBOX&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved`
  );

  return response as GmailHistoryResponse;
}

/**
 * Get current history ID for delta sync starting point
 */
export async function getCurrentHistoryId(): Promise<string | null> {
  const response = await callGmailApi(
    "GET",
    "gmail/v1/users/me/profile"
  );

  return response.historyId || null;
}

/**
 * Mark email as read
 */
export async function markEmailAsRead(messageId: string): Promise<boolean> {
  try {
    await callGmailApi(
      "POST",
      `gmail/v1/users/me/messages/${messageId}/modify`,
      { removeLabelIds: ["UNREAD"] }
    );
    return true;
  } catch (e) {
    console.error(`Failed to mark email as read: ${e}`);
    return false;
  }
}

/**
 * Get thread messages for context
 */
export async function getThreadContext(
  threadId: string,
  limit: number = 5
): Promise<ContextMessage[]> {
  try {
    const response = await callGmailApi(
      "GET",
      `gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
    );

    if (!response.messages) return [];

    return response.messages.slice(-limit).map((msg: GmailMessage) => {
      const from = parseEmailAddress(getHeader(msg, "From"));
      const dateStr = getHeader(msg, "Date");

      return {
        timestamp: dateStr ? new Date(dateStr) : new Date(),
        from: {
          name: from.name,
          address: from.address,
          userId: null,
        },
        body: msg.snippet || "",
      };
    });
  } catch (e) {
    console.error(`Failed to get thread context: ${e}`);
    return [];
  }
}

/**
 * Check if Gmail connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await callGmailApi("GET", "gmail/v1/users/me/profile");
    return !!response.emailAddress;
  } catch (e) {
    return false;
  }
}

// =============================================================================
// Normalized Item Conversion
// =============================================================================

/**
 * Convert Gmail message to normalized Item format
 */
export function normalizeEmail(msg: GmailMessage): Item {
  const id = `email-gmail:${msg.id}`;
  const from = parseEmailAddress(getHeader(msg, "From"));
  const dateStr = getHeader(msg, "Date");
  const isUnread = msg.labelIds?.includes("UNREAD") ?? false;

  return {
    id,
    source: "email-gmail",
    sourceId: msg.id,
    itemType: "message",
    timestamp: dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate || "0")),
    from: {
      name: from.name,
      address: from.address,
      userId: null,
    },
    subject: getHeader(msg, "Subject"),
    body: null, // Would need separate call with format=full
    bodyPreview: msg.snippet?.substring(0, 200) || null,
    threadId: msg.threadId || null,
    threadContext: null,
    metadata: {
      labelIds: msg.labelIds,
      historyId: msg.historyId,
      messageId: getHeader(msg, "Message-ID"),
    },
    readStatus: isUnread ? "unread" : "read",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// Source Adapter Implementation
// =============================================================================

/**
 * Gmail Source Adapter for UnifiedInbox
 */
export const gmailAdapter: SourceAdapter = {
  name: "email-gmail",
  rateLimitMs: 100, // Gmail has per-second quotas

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    let itemsDeleted = 0;
    let newCursor: string | null = null;

    try {
      if (options?.cursor) {
        // Incremental sync using history API
        const history = await getEmailHistory(options.cursor);
        newCursor = history.historyId || null;

        if (history.history) {
          for (const h of history.history) {
            if (h.messagesAdded) {
              itemsProcessed += h.messagesAdded.length;
            }
            if (h.messagesDeleted) {
              itemsDeleted += h.messagesDeleted.length;
            }
          }
        }
      } else {
        // Initial sync
        const limit = options?.limit || 100;
        const emails = await getUnreadEmails(limit);
        itemsProcessed = emails.length;

        // Get history ID for future delta syncs
        newCursor = await getCurrentHistoryId();
      }

      return {
        success: true,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: newCursor,
        duration: Date.now() - startTime,
        nextSyncRecommended: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
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
        cursor: newCursor,
        duration: Date.now() - startTime,
        nextSyncRecommended: null,
      };
    }
  },

  async getItems(since?: Date): Promise<Item[]> {
    const emails = await getUnreadEmails(100);

    let filtered = emails;
    if (since) {
      filtered = emails.filter((e) => {
        const dateStr = getHeader(e, "Date");
        const date = dateStr ? new Date(dateStr) : new Date(parseInt(e.internalDate || "0"));
        return date > since;
      });
    }

    return filtered.map(normalizeEmail);
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(itemId: string): Promise<ContextMessage[]> {
    const messageId = itemId.replace("email-gmail:", "");
    const email = await getEmailById(messageId);
    if (!email?.threadId) return [];
    return getThreadContext(email.threadId);
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
      console.log(healthy ? "Gmail connection OK" : "Gmail connection FAILED");
      process.exit(healthy ? 0 : 1);
      break;

    case "unread":
      const limit = parseInt(args[1]) || 10;
      const emails = await getUnreadEmails(limit);
      console.log(JSON.stringify(emails, null, 2));
      break;

    case "get":
      const messageId = args[1];
      if (!messageId) {
        console.error("Usage: gmail.ts get <messageId>");
        process.exit(1);
      }
      const email = await getEmailById(messageId);
      console.log(JSON.stringify(email, null, 2));
      break;

    case "normalize":
      const normLimit = parseInt(args[1]) || 5;
      const rawEmails = await getUnreadEmails(normLimit);
      const normalized = rawEmails.map(normalizeEmail);
      console.log(JSON.stringify(normalized, null, 2));
      break;

    case "sync":
      const cursor = args[1] || undefined;
      const result = await gmailAdapter.sync({ cursor });
      console.log(JSON.stringify(result, null, 2));
      break;

    case "history-id":
      const historyId = await getCurrentHistoryId();
      console.log(`Current history ID: ${historyId}`);
      break;

    default:
      console.log(`
Gmail API Client - Test CLI

Usage:
  bun gmail.ts health           Check Gmail connection
  bun gmail.ts unread [limit]   Get unread emails
  bun gmail.ts get <messageId>  Get email by ID
  bun gmail.ts normalize [n]    Get normalized items
  bun gmail.ts sync [cursor]    Run sync operation
  bun gmail.ts history-id       Get current history ID
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
