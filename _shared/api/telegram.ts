#!/usr/bin/env bun
/**
 * Telegram API Client - Telegram Bot API for message operations
 *
 * This module provides deterministic functions for reading Telegram messages
 * via the Bot API. Authentication is handled through auth-keeper.sh.
 *
 * Usage:
 *   import { getUpdates, sendMessage, healthCheck } from './_shared/api/telegram';
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN - Bot token (or from BWS via auth-keeper)
 *   TELEGRAM_CHAT_ID   - Default chat ID (or from BWS via auth-keeper)
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
// Raw Telegram API Types
// =============================================================================

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;  // Unix timestamp
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
  }>;
  caption?: string;
  document?: { file_name?: string; mime_type?: string; file_size?: number };
  photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Call Telegram Bot API via auth-keeper
 */
async function callTelegramApi<T>(
  method: string,
  data?: object
): Promise<TelegramApiResponse<T>> {
  let command: string;

  if (data) {
    const json = JSON.stringify(data);
    command = `
source ${AUTH_KEEPER_PATH}
_ak_telegram_api "${method}" -d '${json.replace(/'/g, "'\\''")}'
`.trim();
  } else {
    command = `
source ${AUTH_KEEPER_PATH}
_ak_telegram_api "${method}"
`.trim();
  }

  try {
    const result = await $`bash -c ${command}`.text();
    return JSON.parse(result);
  } catch (e) {
    return {
      ok: false,
      description: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get bot info (used for health check)
 */
export async function getMe(): Promise<TelegramUser | null> {
  const response = await callTelegramApi<TelegramUser>("getMe");
  return response.ok ? response.result || null : null;
}

/**
 * Get recent updates (messages)
 *
 * @param limit Maximum number of updates (1-100)
 * @param offset First update_id to return (for pagination/acknowledgment)
 * @param timeout Long polling timeout in seconds
 */
export async function getUpdates(
  limit: number = 100,
  offset?: number,
  timeout: number = 0
): Promise<TelegramUpdate[]> {
  const data: Record<string, any> = { limit, timeout };
  if (offset !== undefined) {
    data.offset = offset;
  }

  const response = await callTelegramApi<TelegramUpdate[]>("getUpdates", data);

  if (!response.ok || !response.result) {
    console.error(`Telegram getUpdates error: ${response.description}`);
    return [];
  }

  return response.result;
}

/**
 * Send a text message
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  replyToMessageId?: number
): Promise<TelegramMessage | null> {
  const data: Record<string, any> = {
    chat_id: chatId,
    text,
  };

  if (replyToMessageId) {
    data.reply_to_message_id = replyToMessageId;
  }

  const response = await callTelegramApi<TelegramMessage>("sendMessage", data);

  if (!response.ok) {
    console.error(`Telegram sendMessage error: ${response.description}`);
    return null;
  }

  return response.result || null;
}

/**
 * Get messages from a specific chat using getUpdates
 * Note: Bot API doesn't have a dedicated "get chat history" method
 * This filters updates by chat ID
 */
export async function getChatMessages(
  chatId: number,
  limit: number = 50
): Promise<TelegramMessage[]> {
  const updates = await getUpdates(100);

  return updates
    .filter((u) => {
      const msg = u.message || u.edited_message || u.channel_post;
      return msg?.chat.id === chatId;
    })
    .map((u) => u.message || u.edited_message || u.channel_post!)
    .filter((m): m is TelegramMessage => m !== undefined)
    .slice(0, limit);
}

/**
 * Get chat info
 */
export async function getChat(chatId: number | string): Promise<TelegramChat | null> {
  const response = await callTelegramApi<TelegramChat>("getChat", { chat_id: chatId });
  return response.ok ? response.result || null : null;
}

/**
 * Health check - verify bot token is valid
 */
export async function healthCheck(): Promise<boolean> {
  const me = await getMe();
  return me !== null;
}

// =============================================================================
// Normalized Item Conversion
// =============================================================================

/**
 * Get display name for sender
 */
function getSenderName(msg: TelegramMessage): string {
  if (msg.from) {
    const parts = [msg.from.first_name, msg.from.last_name].filter(Boolean);
    return parts.join(" ") || msg.from.username || `User ${msg.from.id}`;
  }
  if (msg.sender_chat) {
    return msg.sender_chat.title || msg.sender_chat.username || `Chat ${msg.sender_chat.id}`;
  }
  return "Unknown";
}

/**
 * Get chat display name/subject
 */
function getChatSubject(chat: TelegramChat): string {
  switch (chat.type) {
    case "private":
      const parts = [chat.first_name, chat.last_name].filter(Boolean);
      return `DM: ${parts.join(" ") || chat.username || `User ${chat.id}`}`;
    case "group":
    case "supergroup":
      return `Group: ${chat.title || "Unknown"}`;
    case "channel":
      return `Channel: ${chat.title || "Unknown"}`;
    default:
      return `Chat ${chat.id}`;
  }
}

/**
 * Convert Telegram message to normalized Item format
 */
export function normalizeMessage(msg: TelegramMessage): Item {
  const id = `telegram:${msg.chat.id}-${msg.message_id}`;

  return {
    id,
    source: "telegram",
    sourceId: `${msg.chat.id}-${msg.message_id}`,
    itemType: "message",
    timestamp: new Date(msg.date * 1000),
    from: {
      name: getSenderName(msg),
      address: msg.from?.username ? `@${msg.from.username}` : null,
      userId: msg.from?.id?.toString() || null,
    },
    subject: getChatSubject(msg.chat),
    body: msg.text || msg.caption || null,
    bodyPreview: (msg.text || msg.caption || "")?.substring(0, 200) || null,
    threadId: msg.reply_to_message
      ? `${msg.chat.id}-${msg.reply_to_message.message_id}`
      : null,
    threadContext: null,
    metadata: {
      chatId: msg.chat.id,
      chatType: msg.chat.type,
      chatTitle: msg.chat.title,
      messageId: msg.message_id,
      hasDocument: !!msg.document,
      hasPhoto: !!msg.photo,
      isForwarded: !!msg.forward_from || !!msg.forward_from_chat,
    },
    readStatus: "unread", // Telegram doesn't track read status for bots
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Convert update to normalized Item (if it contains a message)
 */
export function normalizeUpdate(update: TelegramUpdate): Item | null {
  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg) return null;
  return normalizeMessage(msg);
}

// =============================================================================
// Source Adapter Implementation
// =============================================================================

/**
 * Telegram Source Adapter for UnifiedInbox
 */
export const telegramAdapter: SourceAdapter = {
  name: "telegram",
  rateLimitMs: 1000, // Telegram recommends ~30 requests/second

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    const itemsDeleted = 0;
    let newCursor: string | null = null;

    try {
      // Parse offset from cursor
      const offset = options?.cursor ? parseInt(options.cursor) + 1 : undefined;
      const limit = Math.min(options?.limit || 100, 100);

      const updates = await getUpdates(limit, offset);

      if (updates.length === 0) {
        return {
          success: true,
          itemsProcessed: 0,
          itemsSkipped: 0,
          itemsDeleted: 0,
          errors,
          cursor: options?.cursor || null,
          duration: Date.now() - startTime,
          nextSyncRecommended: new Date(Date.now() + 60 * 1000), // 1 minute
        };
      }

      // Process updates
      for (const update of updates) {
        const msg = update.message || update.edited_message || update.channel_post;
        if (msg?.text || msg?.caption) {
          itemsProcessed++;
        } else {
          itemsSkipped++;
        }
      }

      // Get highest update_id as cursor for next sync
      const maxUpdateId = Math.max(...updates.map((u) => u.update_id));
      newCursor = maxUpdateId.toString();

      return {
        success: true,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor: newCursor,
        duration: Date.now() - startTime,
        nextSyncRecommended: new Date(Date.now() + 60 * 1000), // 1 minute
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
    const updates = await getUpdates(100);

    return updates
      .map(normalizeUpdate)
      .filter((item): item is Item => {
        if (!item) return false;
        if (since && item.timestamp < since) return false;
        return true;
      });
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(itemId: string): Promise<ContextMessage[]> {
    // Telegram's Bot API doesn't support fetching thread history
    // Would need to track locally or use different approach
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
      const me = await getMe();
      console.log(healthy ? "Telegram bot OK" : "Telegram bot FAILED");
      if (me) {
        console.log(`Bot: @${me.username} (${me.first_name})`);
      }
      process.exit(healthy ? 0 : 1);
      break;

    case "updates":
      const limit = parseInt(args[1]) || 10;
      const updates = await getUpdates(limit);
      console.log(JSON.stringify(updates, null, 2));
      break;

    case "send":
      const chatId = args[1];
      const text = args.slice(2).join(" ");
      if (!chatId || !text) {
        console.error("Usage: telegram.ts send <chatId> <message>");
        process.exit(1);
      }
      const result = await sendMessage(chatId, text);
      if (result) {
        console.log(`Message sent: ${result.message_id}`);
      } else {
        console.error("Failed to send message");
        process.exit(1);
      }
      break;

    case "chat":
      const getChatId = args[1];
      if (!getChatId) {
        console.error("Usage: telegram.ts chat <chatId>");
        process.exit(1);
      }
      const chat = await getChat(getChatId);
      console.log(JSON.stringify(chat, null, 2));
      break;

    case "normalize":
      const normLimit = parseInt(args[1]) || 5;
      const normUpdates = await getUpdates(normLimit);
      const normalized = normUpdates
        .map(normalizeUpdate)
        .filter((i): i is Item => i !== null);
      console.log(JSON.stringify(normalized, null, 2));
      break;

    case "sync":
      const cursor = args[1] || undefined;
      const syncResult = await telegramAdapter.sync({ cursor });
      console.log(JSON.stringify(syncResult, null, 2));
      break;

    default:
      console.log(`
Telegram API Client - Test CLI

Usage:
  bun telegram.ts health            Check bot status
  bun telegram.ts updates [limit]   Get recent updates
  bun telegram.ts send <chat> <msg> Send message
  bun telegram.ts chat <chatId>     Get chat info
  bun telegram.ts normalize [n]     Get normalized items
  bun telegram.ts sync [cursor]     Run sync operation
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
