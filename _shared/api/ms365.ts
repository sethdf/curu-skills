#!/usr/bin/env bun
/**
 * MS365 API Client - Microsoft Graph API for email operations
 *
 * This module provides deterministic functions for accessing Microsoft 365 email
 * via the Graph API. Authentication is handled through auth-keeper.sh.
 *
 * Usage:
 *   import { getUnreadEmails, getEmailById, markEmailAsRead } from './_shared/api/ms365';
 *
 * Environment:
 *   MS365_USER - User email address (default from auth-keeper)
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

/**
 * Get MS365 user from environment or auth-keeper defaults
 */
function getUser(): string {
  return process.env.MS365_USER || "sfoley@buxtonco.com";
}

// =============================================================================
// Raw MS365 API Functions
// =============================================================================

interface MS365Message {
  Id: string;
  Subject: string;
  From: {
    EmailAddress: {
      Name: string;
      Address: string;
    };
  };
  ReceivedDateTime: string;
  Body?: {
    Content: string;
    ContentType: string;
  };
  BodyPreview: string;
  ConversationId: string;
  IsRead: boolean;
  ParentFolderId?: string;
  InternetMessageId?: string;
  ToRecipients?: Array<{ EmailAddress: { Name: string; Address: string } }>;
  CcRecipients?: Array<{ EmailAddress: { Name: string; Address: string } }>;
  HasAttachments?: boolean;
  Importance?: string;
  Categories?: string[];
}

interface MS365DeltaResponse {
  value: MS365Message[];
  "@odata.deltaLink"?: string;
  "@odata.nextLink"?: string;
}

/**
 * Execute a PowerShell command via auth-keeper
 */
async function runPowerShell(command: string): Promise<string> {
  // Write PowerShell command to temp file to avoid shell escaping issues
  const tempFile = `/tmp/ms365-${Date.now()}.ps1`;
  await Bun.write(tempFile, command);

  try {
    const result =
      await $`bash -c 'source ${AUTH_KEEPER_PATH} && _ak_ms365_cmd "$(cat ${tempFile})"'`.text();
    return result;
  } finally {
    await $`rm -f ${tempFile}`.quiet();
  }
}

/**
 * Get unread emails from inbox (single page, for backward compatibility)
 */
export async function getUnreadEmails(
  limit: number = 100
): Promise<MS365Message[]> {
  const user = getUser();

  const psCommand = `
\$inbox = Get-MgUserMailFolder -UserId '${user}' | Where-Object { \$_.DisplayName -eq 'Inbox' }
Get-MgUserMailFolderMessage -UserId '${user}' -MailFolderId \$inbox.Id -Filter 'isRead eq false' -Top ${limit} -Select 'id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead,toRecipients,hasAttachments,importance,categories' | ConvertTo-Json -Depth 5
`.trim();

  const result = await runPowerShell(psCommand);

  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch (e) {
    console.error(`Failed to parse MS365 response: ${e}`);
    return [];
  }
}

interface PagedResponse {
  value: MS365Message[];
  "@odata.nextLink"?: string;
}

/**
 * Get ALL unread emails with pagination
 * Fetches pages of 100 until all unread emails are retrieved
 */
export async function getAllUnreadEmails(
  maxPages: number = 20,  // Safety limit: 20 pages = 2000 emails max
  onProgress?: (fetched: number, page: number) => void
): Promise<MS365Message[]> {
  const user = getUser();
  const allMessages: MS365Message[] = [];
  let page = 1;

  // First request - get inbox folder and initial page
  const initialCommand = `
\$inbox = Get-MgUserMailFolder -UserId '${user}' | Where-Object { \$_.DisplayName -eq 'Inbox' }
\$uri = "https://graph.microsoft.com/v1.0/users/${user}/mailFolders/\$(\$inbox.Id)/messages?\\\`\$filter=isRead eq false&\\\`\$top=100&\\\`\$select=id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead,toRecipients,hasAttachments,importance,categories"
Invoke-MgGraphRequest -Method GET -Uri \$uri | ConvertTo-Json -Depth 5
`.trim();

  let result = await runPowerShell(initialCommand);

  try {
    let parsed: PagedResponse = JSON.parse(result);

    while (true) {
      const messages = parsed.value || [];
      allMessages.push(...messages);

      if (onProgress) {
        onProgress(allMessages.length, page);
      }

      // Check if there's a next page
      const nextLink = parsed["@odata.nextLink"];
      if (!nextLink || page >= maxPages) {
        break;
      }

      page++;

      // Fetch next page
      const nextCommand = `
Invoke-MgGraphRequest -Method GET -Uri '${nextLink}' | ConvertTo-Json -Depth 5
`.trim();

      result = await runPowerShell(nextCommand);
      parsed = JSON.parse(result);
    }

    return allMessages;
  } catch (e) {
    console.error(`Failed to parse MS365 paginated response: ${e}`);
    return allMessages; // Return what we have so far
  }
}

/**
 * Get email by ID with full body
 */
export async function getEmailById(
  messageId: string
): Promise<MS365Message | null> {
  const user = getUser();

  const psCommand = `
Get-MgUserMessage -UserId '${user}' -MessageId '${messageId}' -Select 'id,subject,from,receivedDateTime,body,bodyPreview,conversationId,isRead,toRecipients,ccRecipients,hasAttachments,importance,categories,internetMessageId' | ConvertTo-Json -Depth 5
`.trim();

  const result = await runPowerShell(psCommand);

  try {
    return JSON.parse(result);
  } catch (e) {
    console.error(`Failed to get email ${messageId}: ${e}`);
    return null;
  }
}

/**
 * Get emails using delta sync (incremental changes since last sync)
 *
 * Delta sync returns:
 * - New messages
 * - Modified messages (including read status changes)
 * - Deleted message IDs (marked with @removed)
 */
export async function getDeltaEmails(
  deltaLink?: string
): Promise<MS365DeltaResponse> {
  const user = getUser();

  let psCommand: string;

  if (deltaLink) {
    // Use existing delta link for incremental sync
    psCommand = `
\$uri = '${deltaLink}'
Invoke-MgGraphRequest -Method GET -Uri \$uri | ConvertTo-Json -Depth 5
`.trim();
  } else {
    // Initial delta sync - get all messages
    psCommand = `
\$inbox = Get-MgUserMailFolder -UserId '${user}' | Where-Object { \$_.DisplayName -eq 'Inbox' }
\$uri = "https://graph.microsoft.com/v1.0/users/${user}/mailFolders/\$(\$inbox.Id)/messages/delta?\\\`\$select=id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead,hasAttachments,importance"
Invoke-MgGraphRequest -Method GET -Uri \$uri | ConvertTo-Json -Depth 5
`.trim();
  }

  const result = await runPowerShell(psCommand);

  try {
    const parsed = JSON.parse(result);
    return {
      value: Array.isArray(parsed.value) ? parsed.value : [],
      "@odata.deltaLink": parsed["@odata.deltaLink"],
      "@odata.nextLink": parsed["@odata.nextLink"],
    };
  } catch (e) {
    console.error(`Failed to parse delta response: ${e}`);
    return { value: [] };
  }
}

/**
 * Mark email as read
 */
export async function markEmailAsRead(messageId: string): Promise<boolean> {
  const user = getUser();

  const psCommand = `
Update-MgUserMessage -UserId '${user}' -MessageId '${messageId}' -IsRead:\$true
`.trim();

  try {
    await runPowerShell(psCommand);
    return true;
  } catch (e) {
    console.error(`Failed to mark email as read: ${e}`);
    return false;
  }
}

/**
 * Get thread context (conversation messages)
 */
export async function getThreadContext(
  conversationId: string,
  limit: number = 5
): Promise<ContextMessage[]> {
  const user = getUser();

  const psCommand = `
Get-MgUserMessage -UserId '${user}' -Filter "conversationId eq '${conversationId}'" -Top ${limit} -Select 'id,from,receivedDateTime,bodyPreview' -OrderBy 'receivedDateTime desc' | ConvertTo-Json -Depth 5
`.trim();

  const result = await runPowerShell(psCommand);

  try {
    const parsed = JSON.parse(result);
    const messages = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    return messages.map((m: MS365Message) => ({
      timestamp: new Date(m.ReceivedDateTime),
      from: {
        name: m.From?.EmailAddress?.Name || null,
        address: m.From?.EmailAddress?.Address || null,
        userId: null,
      },
      body: m.BodyPreview || "",
    }));
  } catch (e) {
    console.error(`Failed to get thread context: ${e}`);
    return [];
  }
}

/**
 * Check if MS365 connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  const user = getUser();

  const psCommand = `
Get-MgUser -UserId '${user}' | Select-Object UserPrincipalName | ConvertTo-Json
`.trim();

  try {
    const result = await runPowerShell(psCommand);
    const parsed = JSON.parse(result);
    return !!parsed?.UserPrincipalName;
  } catch (e) {
    return false;
  }
}

// =============================================================================
// Normalized Item Conversion
// =============================================================================

/**
 * Convert MS365 message to normalized Item format
 */
export function normalizeEmail(msg: MS365Message): Item {
  const id = `email-ms365:${msg.Id}`;

  return {
    id,
    source: "email-ms365",
    sourceId: msg.Id,
    itemType: "message",
    timestamp: new Date(msg.ReceivedDateTime),
    from: {
      name: msg.From?.EmailAddress?.Name || null,
      address: msg.From?.EmailAddress?.Address || null,
      userId: null, // MS365 doesn't expose internal user IDs easily
    },
    subject: msg.Subject || null,
    body: msg.Body?.Content || null,
    bodyPreview: msg.BodyPreview?.substring(0, 200) || null,
    threadId: msg.ConversationId || null,
    threadContext: null, // Populated separately if needed
    metadata: {
      hasAttachments: msg.HasAttachments,
      importance: msg.Importance,
      categories: msg.Categories,
      internetMessageId: msg.InternetMessageId,
      toRecipients: msg.ToRecipients?.map((r) => r.EmailAddress.Address),
      ccRecipients: msg.CcRecipients?.map((r) => r.EmailAddress.Address),
    },
    readStatus: msg.IsRead ? "read" : "unread",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// Source Adapter Implementation
// =============================================================================

/**
 * MS365 Source Adapter for UnifiedInbox
 */
export const ms365Adapter: SourceAdapter = {
  name: "email-ms365",
  rateLimitMs: 100, // MS Graph has generous limits

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    let itemsDeleted = 0;
    let newCursor: string | null = null;

    try {
      // Use delta sync if cursor provided, otherwise get unread emails
      if (options?.cursor) {
        const delta = await getDeltaEmails(options.cursor);
        newCursor = delta["@odata.deltaLink"] || null;

        for (const msg of delta.value) {
          // Check for deleted items (marked with @removed property)
          if ((msg as any)["@removed"]) {
            itemsDeleted++;
            continue;
          }

          itemsProcessed++;
        }
      } else {
        // Initial sync - get unread emails
        const limit = options?.limit || 100;
        const emails = await getUnreadEmails(limit);
        itemsProcessed = emails.length;

        // Get delta link for future syncs
        const delta = await getDeltaEmails();
        newCursor = delta["@odata.deltaLink"] || null;
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
      filtered = emails.filter(
        (e) => new Date(e.ReceivedDateTime) > since
      );
    }

    return filtered.map(normalizeEmail);
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(itemId: string): Promise<ContextMessage[]> {
    // itemId is in format "email-ms365:messageId"
    const messageId = itemId.replace("email-ms365:", "");
    const email = await getEmailById(messageId);
    if (!email?.ConversationId) return [];
    return getThreadContext(email.ConversationId);
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
      console.log(healthy ? "MS365 connection OK" : "MS365 connection FAILED");
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
        console.error("Usage: ms365.ts get <messageId>");
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
      const result = await ms365Adapter.sync({ cursor });
      console.log(JSON.stringify(result, null, 2));
      break;

    default:
      console.log(`
MS365 API Client - Test CLI

Usage:
  bun ms365.ts health           Check MS365 connection
  bun ms365.ts unread [limit]   Get unread emails
  bun ms365.ts get <messageId>  Get email by ID
  bun ms365.ts normalize [n]    Get normalized items
  bun ms365.ts sync [cursor]    Run sync operation
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
