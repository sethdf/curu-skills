#!/usr/bin/env bun
/**
 * SlackSocketListener.ts - Real-time Slack message capture via Socket Mode
 *
 * Uses Socket Mode to receive messages in real-time and stores them in SQLite
 * for triage. Run as a systemd service for continuous capture.
 *
 * Credentials: Retrieved from BWS via auth-keeper
 */

import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// Configuration
const config = {
  dbPath: join(homedir(), "slack-data/messages.db"),
  authKeeperPath: join(homedir(), "repos/github.com/sethdf/imladris/scripts/auth-keeper.sh"),
  bwsSecrets: {
    appToken: "c577cb73-05c2-424b-9678-b3d901301484",
    userToken: "060ad408-e093-41dc-bb07-b3d401792837",
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

// Initialize database
function initDatabase(): Database.Database {
  const db = new Database(config.dbPath);

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      channel_type TEXT,
      user_id TEXT,
      user_name TEXT,
      text TEXT,
      ts TEXT NOT NULL,
      thread_ts TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      triage_status TEXT DEFAULT 'unread',
      triage_priority TEXT,
      triage_notes TEXT,
      raw_event TEXT
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      is_member INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      real_name TEXT,
      email TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_triage ON messages(triage_status);
    CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at DESC);
  `);

  return db;
}

// Cache for channel and user info
const channelCache = new Map<string, { name: string; type: string }>();
const userCache = new Map<string, { name: string; realName: string }>();

// Get channel info with caching
async function getChannelInfo(
  client: WebClient,
  db: Database.Database,
  channelId: string
): Promise<{ name: string; type: string }> {
  // Check memory cache
  if (channelCache.has(channelId)) {
    return channelCache.get(channelId)!;
  }

  // Check database
  const cached = db.prepare("SELECT name, type FROM channels WHERE id = ?").get(channelId) as
    | { name: string; type: string }
    | undefined;
  if (cached) {
    channelCache.set(channelId, cached);
    return cached;
  }

  // Fetch from API
  try {
    const result = await client.conversations.info({ channel: channelId });
    const channel = result.channel as any;

    let type = "channel";
    if (channel.is_im) type = "im";
    else if (channel.is_mpim) type = "mpim";
    else if (channel.is_private) type = "private";

    const name = channel.name || channel.user || channelId;
    const info = { name, type };

    // Cache it
    channelCache.set(channelId, info);
    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_member, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(channelId, name, type, 1);

    return info;
  } catch (error) {
    console.warn(`Failed to fetch channel info for ${channelId}:`, error);
    return { name: channelId, type: "unknown" };
  }
}

// Get user info with caching
async function getUserInfo(
  client: WebClient,
  db: Database.Database,
  userId: string
): Promise<{ name: string; realName: string }> {
  // Check memory cache
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  // Check database
  const cached = db.prepare("SELECT name, real_name FROM users WHERE id = ?").get(userId) as
    | { name: string; real_name: string }
    | undefined;
  if (cached) {
    const info = { name: cached.name, realName: cached.real_name };
    userCache.set(userId, info);
    return info;
  }

  // Fetch from API
  try {
    const result = await client.users.info({ user: userId });
    const user = result.user as any;

    const name = user.name || userId;
    const realName = user.real_name || user.profile?.real_name || name;
    const info = { name, realName };

    // Cache it
    userCache.set(userId, info);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, real_name, email, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(userId, name, realName, user.profile?.email || null);

    return info;
  } catch (error) {
    console.warn(`Failed to fetch user info for ${userId}:`, error);
    return { name: userId, realName: userId };
  }
}

// Determine channel type for triage priority
function getChannelTypeForTriage(channelType: string, threadTs?: string): string {
  if (threadTs) return "thread";
  return channelType;
}

async function main() {
  console.log("SlackSocketListener starting...");
  console.log(`Database: ${config.dbPath}`);

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

      // Generate unique message ID
      const messageId = `${channelId}-${ts}`;

      // Store in database
      db.prepare(`
        INSERT OR IGNORE INTO messages (
          id, channel_id, channel_name, channel_type, user_id, user_name,
          text, ts, thread_ts, received_at, triage_status, raw_event
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'unread', ?)
      `).run(
        messageId,
        channelId,
        channelInfo.name,
        triageChannelType,
        userId,
        userInfo.realName,
        text,
        ts,
        threadTs || null,
        JSON.stringify(event)
      );

      messageCount++;
      console.log(
        `[${new Date().toISOString()}] #${messageCount} | ${triageChannelType}:${channelInfo.name} | ${userInfo.name}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`
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
