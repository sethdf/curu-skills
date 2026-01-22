#!/usr/bin/env bun
/**
 * Slack API Client - Reads from slackdump SQLite archive
 *
 * This module provides deterministic functions for reading Slack messages
 * from a slackdump SQLite database. The archive is populated by a separate
 * cron job running slackdump.
 *
 * Usage:
 *   import { getRecentMessages, getChannels, getDMs } from './_shared/api/slack';
 *
 * Environment:
 *   SLACK_ARCHIVE - Path to slackdump SQLite (default: ~/slack-archive/slackdump.sqlite)
 *
 * @author PAI System
 * @version 1.0.0
 */

import { $ } from "bun";
import { existsSync } from "fs";
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

/**
 * Get path to slackdump SQLite archive
 */
function getArchivePath(): string {
  return process.env.SLACK_ARCHIVE || join(homedir(), "slack-archive/slackdump.sqlite");
}

// =============================================================================
// Raw Slack Data Types (from slackdump schema)
// =============================================================================

interface SlackMessage {
  id: string;  // Combined channel_id-ts
  source: "slack";
  timestamp: string;
  from_name: string;
  from_address: string;  // User ID
  subject: string;  // Channel name or DM indicator
  body_preview: string;
  thread_id: string;
  channel_id: string;
  channel_name: string;
  channel_type: "channel" | "im" | "mpim";
  user_id: string;
}

interface SlackChannel {
  id: string;
  name: string;
  type: "channel" | "im" | "mpim";
  is_archived: boolean;
  member_count?: number;
}

interface SlackUser {
  id: string;
  username: string;
  real_name: string;
  display_name?: string;
}

// =============================================================================
// Database Query Functions
// =============================================================================

/**
 * Check if slackdump archive exists
 */
export function archiveExists(): boolean {
  return existsSync(getArchivePath());
}

/**
 * Run a SQLite query on the slackdump archive
 */
async function query<T>(sql: string): Promise<T[]> {
  const archivePath = getArchivePath();

  if (!archiveExists()) {
    console.error(`Slack archive not found: ${archivePath}`);
    return [];
  }

  try {
    const result = await $`sqlite3 -json ${archivePath} ${sql}`.text();
    return JSON.parse(result) as T[];
  } catch (e) {
    console.error(`SQLite query failed: ${e}`);
    return [];
  }
}

/**
 * Get recent messages from all conversations (channels, DMs, group DMs)
 */
export async function getRecentMessages(
  limit: number = 100,
  hoursAgo: number = 24
): Promise<SlackMessage[]> {
  // Note: slackdump uses uppercase column names, user data is in DATA blob as JSON
  const sql = `
    SELECT DISTINCT
      m.CHANNEL_ID || '-' || m.TS AS id,
      'slack' AS source,
      datetime(CAST(m.TS AS REAL), 'unixepoch') AS timestamp,
      COALESCE(json_extract(u.DATA, '$.real_name'), u.USERNAME, json_extract(m.DATA, '$.user'), 'Unknown') AS from_name,
      json_extract(m.DATA, '$.user') AS from_address,
      CASE
        WHEN c.ID LIKE 'D%' THEN 'DM: ' || COALESCE(json_extract(u.DATA, '$.real_name'), u.USERNAME, 'Unknown')
        WHEN c.ID LIKE 'G%' THEN 'Group: ' || COALESCE(c.NAME, 'Private')
        ELSE '#' || COALESCE(c.NAME, 'Unknown')
      END AS subject,
      m.TXT AS body_preview,
      COALESCE(m.THREAD_TS, m.TS) AS thread_id,
      c.ID AS channel_id,
      c.NAME AS channel_name,
      CASE
        WHEN c.ID LIKE 'D%' THEN 'im'
        WHEN c.ID LIKE 'G%' THEN 'mpim'
        ELSE 'channel'
      END AS channel_type,
      json_extract(m.DATA, '$.user') AS user_id
    FROM MESSAGE m
    LEFT JOIN S_USER u ON json_extract(m.DATA, '$.user') = u.ID
    LEFT JOIN CHANNEL c ON m.CHANNEL_ID = c.ID
    WHERE datetime(CAST(m.TS AS REAL), 'unixepoch') > datetime('now', '-${hoursAgo} hours')
      AND m.TXT IS NOT NULL
      AND m.TXT <> ''
    GROUP BY m.CHANNEL_ID, m.TS
    ORDER BY m.TS DESC
    LIMIT ${limit};
  `;

  return query<SlackMessage>(sql);
}

/**
 * Get messages from a specific channel
 */
export async function getChannelMessages(
  channelId: string,
  limit: number = 50
): Promise<SlackMessage[]> {
  const sql = `
    SELECT DISTINCT
      m.CHANNEL_ID || '-' || m.TS AS id,
      'slack' AS source,
      datetime(CAST(m.TS AS REAL), 'unixepoch') AS timestamp,
      COALESCE(json_extract(u.DATA, '$.real_name'), u.USERNAME, 'Unknown') AS from_name,
      json_extract(m.DATA, '$.user') AS from_address,
      c.NAME AS subject,
      m.TXT AS body_preview,
      COALESCE(m.THREAD_TS, m.TS) AS thread_id,
      c.ID AS channel_id,
      c.NAME AS channel_name,
      'channel' AS channel_type,
      json_extract(m.DATA, '$.user') AS user_id
    FROM MESSAGE m
    LEFT JOIN S_USER u ON json_extract(m.DATA, '$.user') = u.ID
    LEFT JOIN CHANNEL c ON m.CHANNEL_ID = c.ID
    WHERE m.CHANNEL_ID = '${channelId}'
      AND m.TXT IS NOT NULL
      AND m.TXT <> ''
    ORDER BY m.TS DESC
    LIMIT ${limit};
  `;

  return query<SlackMessage>(sql);
}

/**
 * Get thread context (messages in a thread)
 */
export async function getThreadMessages(
  channelId: string,
  threadTs: string,
  limit: number = 10
): Promise<ContextMessage[]> {
  const sql = `
    SELECT
      datetime(CAST(m.TS AS REAL), 'unixepoch') AS timestamp,
      COALESCE(json_extract(u.DATA, '$.real_name'), u.USERNAME, 'Unknown') AS from_name,
      json_extract(m.DATA, '$.user') AS from_address,
      m.TXT AS body
    FROM MESSAGE m
    LEFT JOIN S_USER u ON json_extract(m.DATA, '$.user') = u.ID
    WHERE m.CHANNEL_ID = '${channelId}'
      AND (m.THREAD_TS = '${threadTs}' OR m.TS = '${threadTs}')
    ORDER BY m.TS ASC
    LIMIT ${limit};
  `;

  const results = await query<{
    timestamp: string;
    from_name: string;
    from_address: string;
    body: string;
  }>(sql);

  return results.map((r) => ({
    timestamp: new Date(r.timestamp),
    from: {
      name: r.from_name,
      address: null,
      userId: r.from_address,
    },
    body: r.body,
  }));
}

/**
 * Get list of channels
 */
export async function getChannels(): Promise<SlackChannel[]> {
  const sql = `
    SELECT
      ID AS id,
      NAME AS name,
      CASE
        WHEN ID LIKE 'D%' THEN 'im'
        WHEN ID LIKE 'G%' THEN 'mpim'
        ELSE 'channel'
      END AS type,
      0 AS is_archived
    FROM CHANNEL
    ORDER BY NAME;
  `;

  return query<SlackChannel>(sql);
}

/**
 * Get list of DMs
 */
export async function getDMs(): Promise<SlackMessage[]> {
  return getRecentMessages(50, 168).then((msgs) =>
    msgs.filter((m) => m.channel_type === "im")
  );
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<SlackUser | null> {
  const sql = `
    SELECT
      ID AS id,
      USERNAME AS username,
      COALESCE(json_extract(DATA, '$.real_name'), USERNAME) AS real_name,
      json_extract(DATA, '$.profile.display_name') AS display_name
    FROM S_USER
    WHERE ID = '${userId}';
  `;

  const results = await query<SlackUser>(sql);
  return results[0] || null;
}

/**
 * Get archive last modified time
 */
export async function getLastModified(): Promise<Date | null> {
  const archivePath = getArchivePath();

  if (!archiveExists()) return null;

  try {
    const result = await $`stat -c %Y ${archivePath}`.text();
    const timestamp = parseInt(result.trim());
    return new Date(timestamp * 1000);
  } catch {
    return null;
  }
}

/**
 * Health check - verify archive exists and is readable
 */
export async function healthCheck(): Promise<boolean> {
  if (!archiveExists()) return false;

  try {
    const result = await query<{ cnt: number }>("SELECT COUNT(*) as cnt FROM MESSAGE LIMIT 1;");
    return result.length > 0;
  } catch {
    return false;
  }
}

// =============================================================================
// Normalized Item Conversion
// =============================================================================

/**
 * Convert Slack message to normalized Item format
 */
export function normalizeMessage(msg: SlackMessage): Item {
  const id = `slack:${msg.id}`;

  return {
    id,
    source: "slack",
    sourceId: msg.id,
    itemType: "message",
    timestamp: new Date(msg.timestamp),
    from: {
      name: msg.from_name,
      address: null,
      userId: msg.user_id,
    },
    subject: msg.subject,
    body: null,
    bodyPreview: msg.body_preview?.substring(0, 200) || null,
    threadId: msg.thread_id,
    threadContext: null,
    metadata: {
      channelId: msg.channel_id,
      channelName: msg.channel_name,
      channelType: msg.channel_type,
    },
    readStatus: "unread", // Slackdump doesn't track read status
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// Source Adapter Implementation
// =============================================================================

/**
 * Slack Source Adapter for UnifiedInbox
 *
 * Note: This adapter reads from slackdump archive, which is populated
 * by a separate cron job. It doesn't sync directly from Slack API.
 */
export const slackAdapter: SourceAdapter = {
  name: "slack",

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let itemsProcessed = 0;
    let itemsSkipped = 0;
    const itemsDeleted = 0;

    try {
      if (!archiveExists()) {
        errors.push({
          message: `Slack archive not found: ${getArchivePath()}`,
          retryable: false,
        });
        return {
          success: false,
          itemsProcessed: 0,
          itemsSkipped: 0,
          itemsDeleted: 0,
          errors,
          cursor: null,
          duration: Date.now() - startTime,
          nextSyncRecommended: null,
        };
      }

      // Get messages from archive
      const limit = options?.limit || 100;
      const hoursAgo = options?.since
        ? Math.ceil((Date.now() - options.since.getTime()) / (1000 * 60 * 60))
        : 24;

      const messages = await getRecentMessages(limit, hoursAgo);
      itemsProcessed = messages.length;

      // Get archive modification time as cursor
      const lastMod = await getLastModified();
      const cursor = lastMod?.toISOString() || null;

      return {
        success: true,
        itemsProcessed,
        itemsSkipped,
        itemsDeleted,
        errors,
        cursor,
        duration: Date.now() - startTime,
        nextSyncRecommended: new Date(Date.now() + 60 * 60 * 1000), // 1 hour (slackdump cron)
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
    const hoursAgo = since
      ? Math.ceil((Date.now() - since.getTime()) / (1000 * 60 * 60))
      : 24;

    const messages = await getRecentMessages(100, hoursAgo);
    return messages.map(normalizeMessage);
  },

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  },

  async getThreadContext(itemId: string): Promise<ContextMessage[]> {
    // itemId is "slack:channelId-ts"
    const [, composite] = itemId.split(":");
    const [channelId, ts] = composite.split("-");
    if (!channelId || !ts) return [];
    return getThreadMessages(channelId, ts);
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
      console.log(healthy ? "Slack archive OK" : "Slack archive FAILED");
      console.log(`Archive path: ${getArchivePath()}`);
      console.log(`Exists: ${archiveExists()}`);
      process.exit(healthy ? 0 : 1);
      break;

    case "recent":
      const limit = parseInt(args[1]) || 20;
      const hours = parseInt(args[2]) || 24;
      const messages = await getRecentMessages(limit, hours);
      console.log(JSON.stringify(messages, null, 2));
      break;

    case "channels":
      const channels = await getChannels();
      console.log(JSON.stringify(channels, null, 2));
      break;

    case "dms":
      const dms = await getDMs();
      console.log(JSON.stringify(dms, null, 2));
      break;

    case "channel":
      const channelId = args[1];
      if (!channelId) {
        console.error("Usage: slack.ts channel <channelId>");
        process.exit(1);
      }
      const channelMsgs = await getChannelMessages(channelId);
      console.log(JSON.stringify(channelMsgs, null, 2));
      break;

    case "normalize":
      const normLimit = parseInt(args[1]) || 5;
      const rawMsgs = await getRecentMessages(normLimit);
      const normalized = rawMsgs.map(normalizeMessage);
      console.log(JSON.stringify(normalized, null, 2));
      break;

    case "sync":
      const result = await slackAdapter.sync({});
      console.log(JSON.stringify(result, null, 2));
      break;

    case "last-modified":
      const lastMod = await getLastModified();
      console.log(`Last modified: ${lastMod?.toISOString() || "unknown"}`);
      break;

    default:
      console.log(`
Slack API Client (slackdump reader) - Test CLI

Usage:
  bun slack.ts health                 Check archive status
  bun slack.ts recent [limit] [hours] Get recent messages
  bun slack.ts channels               List channels
  bun slack.ts dms                    List DMs
  bun slack.ts channel <id>           Get channel messages
  bun slack.ts normalize [n]          Get normalized items
  bun slack.ts sync                   Run sync operation
  bun slack.ts last-modified          Check archive modification time

Environment:
  SLACK_ARCHIVE   Path to slackdump SQLite
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
