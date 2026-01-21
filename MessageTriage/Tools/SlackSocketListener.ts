#!/usr/bin/env bun
/**
 * SlackSocketListener.ts - Real-time Slack message capture via Socket Mode
 *
 * Captures messages in real-time and stores them in the unified message-triage cache
 * with surrounding context for AI categorization.
 *
 * Context Strategy:
 * - For channel messages: fetch last 5 messages in channel for context
 * - For thread replies: fetch parent message + sibling replies
 * - For DMs: fetch last 3 messages in conversation
 *
 * Credentials: Retrieved from BWS via auth-keeper
 */

import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// Configuration - use unified cache
const config = {
  cacheDir: join(homedir(), ".cache/message-triage"),
  cacheDb: join(homedir(), ".cache/message-triage/messages.sqlite"),
  authKeeperPath: join(homedir(), "repos/github.com/sethdf/imladris/scripts/auth-keeper.sh"),
  bwsSecrets: {
    appToken: "c577cb73-05c2-424b-9678-b3d901301484",
    userToken: "060ad408-e093-41dc-bb07-b3d401792837",
  },
  contextSize: {
    channel: 5,  // Last 5 messages for channel context
    thread: 10,  // Parent + up to 9 replies for thread context
    dm: 3,       // Last 3 messages for DM context
  },
};

// Retrieve secrets from BWS
function getSecret(secretId: string): string {
  try {
    const result = execSync(
      `bash -c 'source ${config.authKeeperPath} && bws secret get ${secretId} 2>/dev/null'`,
      { encoding: "utf-8" }
    );
    const parsed = JSON.parse(result);
    return parsed.value;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretId}:`, error);
    process.exit(1);
  }
}

// Initialize unified cache database
function initDatabase(): Database {
  if (!existsSync(config.cacheDir)) {
    mkdirSync(config.cacheDir, { recursive: true });
  }

  const db = new Database(config.cacheDb, { create: true });

  // Ensure schema matches AutoTriage unified schema
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      timestamp TEXT,
      from_name TEXT,
      from_address TEXT,
      subject TEXT,
      body TEXT,
      body_preview TEXT,
      thread_id TEXT,
      is_read INTEGER DEFAULT 0,
      category TEXT,
      confidence INTEGER,
      reasoning TEXT,
      exported_at TEXT DEFAULT CURRENT_TIMESTAMP,
      run_id TEXT,
      channel_id TEXT,
      channel_name TEXT,
      channel_type TEXT,
      user_id TEXT,
      triage_status TEXT DEFAULT 'unread',
      context_messages TEXT,
      raw_event TEXT
    )
  `);

  // Create indexes (ignore if exists)
  try { db.run("CREATE INDEX idx_messages_source ON messages(source)"); } catch {}
  try { db.run("CREATE INDEX idx_messages_category ON messages(category)"); } catch {}
  try { db.run("CREATE INDEX idx_messages_channel ON messages(channel_id)"); } catch {}
  try { db.run("CREATE INDEX idx_messages_triage_status ON messages(triage_status)"); } catch {}

  // Channels cache for name lookups
  db.run(`
    CREATE TABLE IF NOT EXISTS slack_channels (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users cache for name lookups
  db.run(`
    CREATE TABLE IF NOT EXISTS slack_users (
      id TEXT PRIMARY KEY,
      name TEXT,
      real_name TEXT,
      email TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

// Cache for channel and user info
const channelCache = new Map<string, { name: string; type: string }>();
const userCache = new Map<string, { name: string; realName: string }>();

// Get channel info with caching
async function getChannelInfo(
  client: WebClient,
  db: Database,
  channelId: string
): Promise<{ name: string; type: string }> {
  if (channelCache.has(channelId)) {
    return channelCache.get(channelId)!;
  }

  const cached = db.query("SELECT name, type FROM slack_channels WHERE id = ?").get(channelId) as
    | { name: string; type: string }
    | null;
  if (cached) {
    channelCache.set(channelId, cached);
    return cached;
  }

  try {
    const result = await client.conversations.info({ channel: channelId });
    const channel = result.channel as any;

    let type = "channel";
    if (channel.is_im) type = "im";
    else if (channel.is_mpim) type = "mpim";
    else if (channel.is_private) type = "private";

    const name = channel.name || channel.user || channelId;
    const info = { name, type };

    channelCache.set(channelId, info);
    db.run(
      "INSERT OR REPLACE INTO slack_channels (id, name, type, updated_at) VALUES (?, ?, ?, datetime('now'))",
      [channelId, name, type]
    );

    return info;
  } catch (error) {
    console.warn(`Failed to fetch channel info for ${channelId}:`, error);
    return { name: channelId, type: "unknown" };
  }
}

// Get user info with caching
async function getUserInfo(
  client: WebClient,
  db: Database,
  userId: string
): Promise<{ name: string; realName: string }> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  const cached = db.query("SELECT name, real_name FROM slack_users WHERE id = ?").get(userId) as
    | { name: string; real_name: string }
    | null;
  if (cached) {
    const info = { name: cached.name, realName: cached.real_name };
    userCache.set(userId, info);
    return info;
  }

  try {
    const result = await client.users.info({ user: userId });
    const user = result.user as any;

    const name = user.name || userId;
    const realName = user.real_name || user.profile?.real_name || name;
    const info = { name, realName };

    userCache.set(userId, info);
    db.run(
      "INSERT OR REPLACE INTO slack_users (id, name, real_name, email, updated_at) VALUES (?, ?, ?, ?, datetime('now'))",
      [userId, name, realName, user.profile?.email || null]
    );

    return info;
  } catch (error) {
    console.warn(`Failed to fetch user info for ${userId}:`, error);
    return { name: userId, realName: userId };
  }
}

// Fetch context messages for AI categorization
async function fetchContext(
  client: WebClient,
  db: Database,
  channelId: string,
  channelType: string,
  threadTs?: string,
  currentTs?: string
): Promise<Array<{ from: string; text: string; ts: string }>> {
  const context: Array<{ from: string; text: string; ts: string }> = [];

  try {
    if (threadTs) {
      // Thread context: get parent + replies
      const replies = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: config.contextSize.thread,
      });

      if (replies.messages) {
        for (const msg of replies.messages) {
          if (msg.ts === currentTs) continue; // Skip the current message
          const userInfo = msg.user ? await getUserInfo(client, db, msg.user) : { realName: "Unknown" };
          context.push({
            from: userInfo.realName,
            text: (msg.text || "").substring(0, 200),
            ts: msg.ts || "",
          });
        }
      }
    } else {
      // Channel context: get recent messages
      const limit = channelType === "im" || channelType === "mpim"
        ? config.contextSize.dm
        : config.contextSize.channel;

      const history = await client.conversations.history({
        channel: channelId,
        limit: limit + 1, // +1 because current message might be included
      });

      if (history.messages) {
        for (const msg of history.messages) {
          if (msg.ts === currentTs) continue;
          if (context.length >= limit) break;
          const userInfo = msg.user ? await getUserInfo(client, db, msg.user) : { realName: "Unknown" };
          context.push({
            from: userInfo.realName,
            text: (msg.text || "").substring(0, 200),
            ts: msg.ts || "",
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch context for channel ${channelId}:`, error);
  }

  // Sort by timestamp (oldest first for context)
  return context.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
}

// Determine channel type for triage priority
function getChannelTypeForTriage(channelType: string, threadTs?: string): string {
  if (threadTs) return "thread";
  return channelType;
}

async function main() {
  console.log("SlackSocketListener starting...");
  console.log(`Unified cache: ${config.cacheDb}`);

  // Get tokens from BWS
  console.log("Retrieving credentials from BWS...");
  const appToken = getSecret(config.bwsSecrets.appToken);
  const userToken = getSecret(config.bwsSecrets.userToken);

  if (!appToken.startsWith("xapp-")) {
    console.error("Invalid app token - must start with xapp-");
    process.exit(1);
  }

  console.log("Credentials retrieved successfully");

  // Initialize database
  const db = initDatabase();
  console.log("Database initialized");

  // Initialize Slack clients
  const socketClient = new SocketModeClient({ appToken });
  const webClient = new WebClient(userToken);

  // Prepared statement for message insertion
  const insertMessage = db.query(`
    INSERT OR REPLACE INTO messages (
      id, source, timestamp, from_name, from_address, subject, body_preview,
      thread_id, channel_id, channel_name, channel_type, user_id,
      triage_status, context_messages, raw_event, exported_at
    ) VALUES (?, 'slack', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?, datetime('now'))
  `);

  // Message counter for logging
  let messageCount = 0;

  // Handle message events
  socketClient.on("message", async ({ event, ack }) => {
    await ack();

    // Skip bot messages, message_changed, message_deleted, etc.
    if (event.subtype && event.subtype !== "thread_broadcast") {
      return;
    }

    // Skip messages from bots
    if (event.bot_id) {
      return;
    }

    try {
      const channelId = event.channel;
      const userId = event.user;
      const text = event.text || "";
      const ts = event.ts;
      const threadTs = event.thread_ts;

      // Get channel and user info
      const channelInfo = await getChannelInfo(webClient, db, channelId);
      const userInfo = userId ? await getUserInfo(webClient, db, userId) : { name: "unknown", realName: "Unknown" };

      // Determine channel type for triage
      const triageChannelType = getChannelTypeForTriage(channelInfo.type, threadTs);

      // Fetch context messages for AI categorization
      const context = await fetchContext(webClient, db, channelId, channelInfo.type, threadTs, ts);

      // Generate unique message ID
      const messageId = `slack-${channelId}-${ts}`;

      // Create subject from channel/thread info
      const subject = threadTs
        ? `Thread reply in #${channelInfo.name}`
        : triageChannelType === "im"
          ? `DM from ${userInfo.realName}`
          : triageChannelType === "mpim"
            ? `Group DM in ${channelInfo.name}`
            : `#${channelInfo.name}`;

      // Store in unified cache
      insertMessage.run(
        messageId,
        ts,
        userInfo.realName,
        userId,
        subject,
        text.substring(0, 500),
        threadTs || null,
        channelId,
        channelInfo.name,
        triageChannelType,
        userId,
        JSON.stringify(context),
        JSON.stringify(event)
      );

      messageCount++;
      const contextCount = context.length;
      console.log(
        `[${new Date().toISOString()}] #${messageCount} | ${triageChannelType}:${channelInfo.name} | ${userInfo.name}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""} [${contextCount} ctx]`
      );
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  // Handle connection events
  socketClient.on("connected", () => {
    console.log(`[${new Date().toISOString()}] Connected to Slack Socket Mode`);
  });

  socketClient.on("disconnected", () => {
    console.log(`[${new Date().toISOString()}] Disconnected from Slack Socket Mode`);
  });

  socketClient.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Socket Mode error:`, error);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the client
  console.log("Connecting to Slack Socket Mode...");
  await socketClient.start();
  console.log("SlackSocketListener is running. Press Ctrl+C to stop.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
