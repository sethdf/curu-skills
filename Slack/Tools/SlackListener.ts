#!/usr/bin/env bun
/**
 * SlackListener.ts - Real-time Slack message listener using Socket Mode
 *
 * Receives messages via WebSocket and stores in SQLite for AI triage.
 *
 * Usage:
 *   bun SlackListener.ts              # Start listener daemon
 *   bun SlackListener.ts --status     # Check connection status
 *   bun SlackListener.ts --init-db    # Initialize database only
 *
 * Environment (via BWS):
 *   slack-app-token   - xapp- token for Socket Mode
 *   slack-user-token  - xoxp- token for API calls
 */

import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

// Configuration
const DB_PATH = join(process.env.HOME || '', 'slack-data', 'messages.db');
const LOG_PATH = join(process.env.HOME || '', 'logs', 'slack-listener.log');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Get tokens from BWS
async function getToken(secretName: string): Promise<string> {
  try {
    const result = await $`bws secret get ${secretName} --output json`.json();
    return result.value;
  } catch (error) {
    console.error(`${colors.red}Failed to get ${secretName} from BWS${colors.reset}`);
    throw error;
  }
}

// Initialize SQLite database
function initDatabase(dbPath: string): Database {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath, { create: true });

  // Create tables
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

// Log message to file and console
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const color = level === 'ERROR' ? colors.red : level === 'WARN' ? colors.yellow : colors.green;

  const logLine = `[${timestamp}] ${level}: ${message}`;
  console.log(`${color}${logLine}${colors.reset}`, data ? JSON.stringify(data, null, 2) : '');

  // Append to log file
  try {
    const logDir = join(LOG_PATH, '..');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const file = Bun.file(LOG_PATH);
    const existing = existsSync(LOG_PATH) ? await file.text() : '';
    Bun.write(LOG_PATH, existing + `${logLine} ${data ? JSON.stringify(data) : ''}\n`);
  } catch {}
}

// Determine channel type from ID
function getChannelType(channelId: string): string {
  if (channelId.startsWith('D')) return 'dm';
  if (channelId.startsWith('G')) return 'group_dm';  // Legacy MPIMs
  if (channelId.startsWith('C')) return 'channel';   // Could be MPIM or channel
  return 'unknown';
}

// Main listener
async function startListener() {
  console.log(`${colors.green}Starting Slack Socket Mode listener...${colors.reset}`);

  // Get tokens
  const appToken = await getToken('slack-app-token');
  const userToken = await getToken('slack-user-token');

  // Initialize database
  const db = initDatabase(DB_PATH);
  console.log(`${colors.cyan}Database initialized at ${DB_PATH}${colors.reset}`);

  // Prepare statements
  const insertMessage = db.prepare(`
    INSERT OR REPLACE INTO messages
    (id, channel_id, channel_name, channel_type, user_id, user_name, text, ts, thread_ts, raw_event)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertChannel = db.prepare(`
    INSERT OR REPLACE INTO channels (id, name, type, is_member, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const upsertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, real_name, email, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  // Initialize clients
  const socketClient = new SocketModeClient({ appToken });
  const webClient = new WebClient(userToken);

  // Cache for channel/user names
  const channelCache = new Map<string, string>();
  const userCache = new Map<string, string>();

  // Get channel name (with caching)
  async function getChannelName(channelId: string): Promise<string> {
    if (channelCache.has(channelId)) return channelCache.get(channelId)!;

    try {
      const result = await webClient.conversations.info({ channel: channelId });
      const name = (result.channel as any)?.name || channelId;
      channelCache.set(channelId, name);

      const channelType = getChannelType(channelId);
      upsertChannel.run(channelId, name, channelType, 1);

      return name;
    } catch {
      return channelId;
    }
  }

  // Get user name (with caching)
  async function getUserName(userId: string): Promise<string> {
    if (!userId) return 'unknown';
    if (userCache.has(userId)) return userCache.get(userId)!;

    try {
      const result = await webClient.users.info({ user: userId });
      const user = result.user as any;
      const name = user?.name || user?.real_name || userId;
      userCache.set(userId, name);

      upsertUser.run(userId, user?.name, user?.real_name, user?.profile?.email);

      return name;
    } catch {
      return userId;
    }
  }

  // Handle message events
  socketClient.on('message', async ({ event, ack }) => {
    await ack();

    // Skip bot messages and message_changed events for now
    if (event.bot_id || event.subtype === 'message_changed') return;

    const channelId = event.channel;
    const channelType = getChannelType(channelId);
    const channelName = await getChannelName(channelId);
    const userName = await getUserName(event.user);

    const messageId = `${channelId}-${event.ts}`;

    insertMessage.run(
      messageId,
      channelId,
      channelName,
      channelType,
      event.user,
      userName,
      event.text || '',
      event.ts,
      event.thread_ts || null,
      JSON.stringify(event)
    );

    const preview = (event.text || '').substring(0, 50);
    console.log(`${colors.cyan}[${channelType}]${colors.reset} #${channelName} <${userName}>: ${preview}${preview.length >= 50 ? '...' : ''}`);
  });

  // Handle connection events
  socketClient.on('connected', () => {
    console.log(`${colors.green}Connected to Slack Socket Mode${colors.reset}`);
  });

  socketClient.on('disconnected', () => {
    console.log(`${colors.yellow}Disconnected from Slack Socket Mode${colors.reset}`);
  });

  socketClient.on('error', (error) => {
    console.error(`${colors.red}Socket Mode error:${colors.reset}`, error);
  });

  // Start the connection
  await socketClient.start();
  console.log(`${colors.green}Slack listener running. Press Ctrl+C to stop.${colors.reset}`);

  // Keep alive
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
    db.close();
    process.exit(0);
  });
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--init-db')) {
  const db = initDatabase(DB_PATH);
  console.log(`${colors.green}Database initialized at ${DB_PATH}${colors.reset}`);
  db.close();
} else if (args.includes('--status')) {
  console.log(`${colors.cyan}Checking Slack listener status...${colors.reset}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Exists: ${existsSync(DB_PATH)}`);

  if (existsSync(DB_PATH)) {
    const db = new Database(DB_PATH, { readonly: true });
    const count = db.query('SELECT COUNT(*) as count FROM messages').get() as any;
    const latest = db.query('SELECT datetime(received_at) as latest FROM messages ORDER BY received_at DESC LIMIT 1').get() as any;
    const unread = db.query("SELECT COUNT(*) as count FROM messages WHERE triage_status = 'unread'").get() as any;
    console.log(`Messages: ${count?.count || 0}`);
    console.log(`Unread: ${unread?.count || 0}`);
    console.log(`Latest: ${latest?.latest || 'none'}`);
    db.close();
  }
} else {
  startListener().catch((err) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, err);
    process.exit(1);
  });
}
