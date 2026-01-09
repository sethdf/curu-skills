#!/usr/bin/env bun
/**
 * Slack CLI Client
 *
 * Token-efficient Slack integration using Web API.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun SlackClient.ts <command> [args]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const CONFIG_DIR = process.env.SLACK_CONFIG_DIR || join(homedir(), ".config", "slack-cli");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const API_BASE = "https://slack.com/api";

// Types
interface Config {
  botToken?: string;
  userToken?: string;
  defaultChannel?: string;
}

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

// Utility functions
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadConfig(): Config {
  // Try environment variables first
  const botToken = process.env.SLACK_BOT_TOKEN;
  const userToken = process.env.SLACK_USER_TOKEN;

  if (botToken || userToken) {
    return { botToken, userToken };
  }

  // Fall back to config file
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  }

  console.error("Error: No Slack token found.");
  console.error("Set SLACK_BOT_TOKEN or SLACK_USER_TOKEN environment variable,");
  console.error(`or create ${CONFIG_PATH} with token configuration.`);
  process.exit(1);
}

function getToken(): string {
  const config = loadConfig();
  const token = config.botToken || config.userToken;
  if (!token) {
    console.error("Error: No token configured");
    process.exit(1);
  }
  return token;
}

async function slackApi(method: string, params: Record<string, any> = {}): Promise<SlackResponse> {
  const token = getToken();

  const response = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(params),
  });

  const data = await response.json() as SlackResponse;

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

// Resolve channel name to ID
async function resolveChannel(channel: string): Promise<string> {
  // Already an ID
  if (channel.startsWith("C") || channel.startsWith("D") || channel.startsWith("G")) {
    return channel;
  }

  // Strip # prefix
  const name = channel.replace(/^#/, "");

  // List channels and find by name
  const data = await slackApi("conversations.list", {
    types: "public_channel,private_channel",
    limit: 200,
  });

  const found = data.channels?.find((c: any) => c.name === name);
  if (!found) {
    throw new Error(`Channel not found: ${channel}`);
  }

  return found.id;
}

// Resolve user name to ID
async function resolveUser(user: string): Promise<string> {
  // Already an ID
  if (user.startsWith("U")) {
    return user;
  }

  // Strip @ prefix
  const name = user.replace(/^@/, "");

  // List users and find by name
  const data = await slackApi("users.list", { limit: 200 });

  const found = data.members?.find(
    (u: any) => u.name === name || u.profile?.display_name === name
  );
  if (!found) {
    throw new Error(`User not found: ${user}`);
  }

  return found.id;
}

function formatTimestamp(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleString();
}

// Commands
async function testAuth(): Promise<void> {
  const data = await slackApi("auth.test");
  console.log("Authentication successful!");
  console.log(`  Team: ${data.team}`);
  console.log(`  User: ${data.user}`);
  console.log(`  Bot ID: ${data.bot_id || "N/A"}`);
}

async function listChannels(): Promise<void> {
  const data = await slackApi("conversations.list", {
    types: "public_channel,private_channel",
    limit: 100,
  });

  console.log("\nChannels:\n");
  for (const channel of data.channels || []) {
    const memberCount = channel.num_members || 0;
    const prefix = channel.is_private ? "🔒" : "#";
    console.log(`  ${prefix}${channel.name} (${memberCount} members) [${channel.id}]`);
  }
}

async function readChannel(channel: string, limit = 20): Promise<void> {
  const channelId = await resolveChannel(channel);

  const data = await slackApi("conversations.history", {
    channel: channelId,
    limit,
  });

  // Get channel info
  const channelInfo = await slackApi("conversations.info", { channel: channelId });
  const channelName = channelInfo.channel?.name || channelId;

  console.log(`\n#${channelName} - Recent messages:\n`);

  // Get user info for display names
  const userCache: Record<string, string> = {};

  for (const msg of (data.messages || []).reverse()) {
    let userName = msg.user || "unknown";
    if (msg.user && !userCache[msg.user]) {
      try {
        const userInfo = await slackApi("users.info", { user: msg.user });
        userCache[msg.user] = userInfo.user?.profile?.display_name || userInfo.user?.name || msg.user;
      } catch {
        userCache[msg.user] = msg.user;
      }
    }
    userName = userCache[msg.user] || userName;

    const time = formatTimestamp(msg.ts);
    const threadIndicator = msg.thread_ts && msg.thread_ts !== msg.ts ? " (in thread)" : "";
    const text = msg.text?.substring(0, 200) || "[no text]";

    console.log(`[${time}] ${userName}${threadIndicator}`);
    console.log(`  ${text}`);
    if (msg.thread_ts === msg.ts && msg.reply_count) {
      console.log(`  └─ ${msg.reply_count} replies`);
    }
    console.log();
  }
}

async function sendMessage(channel: string, text: string): Promise<void> {
  const channelId = await resolveChannel(channel);

  const data = await slackApi("chat.postMessage", {
    channel: channelId,
    text,
  });

  console.log(`Message sent to #${channel}`);
  console.log(`  Timestamp: ${data.ts}`);
  console.log(`  Use for threading: /slack thread ${channel} ${data.ts} "reply"`);
}

async function sendDM(user: string, text: string): Promise<void> {
  const userId = await resolveUser(user);

  // Open DM channel
  const dmData = await slackApi("conversations.open", { users: userId });
  const channelId = dmData.channel?.id;

  if (!channelId) {
    throw new Error("Failed to open DM channel");
  }

  const data = await slackApi("chat.postMessage", {
    channel: channelId,
    text,
  });

  console.log(`DM sent to @${user}`);
  console.log(`  Timestamp: ${data.ts}`);
}

async function replyThread(channel: string, threadTs: string, text: string): Promise<void> {
  const channelId = await resolveChannel(channel);

  const data = await slackApi("chat.postMessage", {
    channel: channelId,
    text,
    thread_ts: threadTs,
  });

  console.log(`Reply sent in thread`);
  console.log(`  Timestamp: ${data.ts}`);
}

async function searchMessages(query: string): Promise<void> {
  // Search requires user token
  const config = loadConfig();
  if (!config.userToken) {
    console.error("Search requires a user token (xoxp-...), not a bot token.");
    console.error("Set SLACK_USER_TOKEN environment variable.");
    process.exit(1);
  }

  const data = await slackApi("search.messages", {
    query,
    count: 20,
  });

  console.log(`\nSearch results for "${query}":\n`);

  const matches = data.messages?.matches || [];
  if (matches.length === 0) {
    console.log("  No results found.");
    return;
  }

  for (const match of matches) {
    const time = formatTimestamp(match.ts);
    const channel = match.channel?.name || "unknown";
    const user = match.username || match.user || "unknown";
    const text = match.text?.substring(0, 150) || "[no text]";

    console.log(`[${time}] #${channel} - ${user}`);
    console.log(`  ${text}`);
    console.log(`  Link: ${match.permalink}`);
    console.log();
  }
}

async function listUsers(): Promise<void> {
  const data = await slackApi("users.list", { limit: 200 });

  console.log("\nWorkspace Users:\n");
  for (const user of data.members || []) {
    if (user.deleted || user.is_bot) continue;

    const displayName = user.profile?.display_name || user.name;
    const realName = user.profile?.real_name || "";
    const status = user.profile?.status_text ? ` - ${user.profile.status_text}` : "";

    console.log(`  @${user.name} (${realName})${status} [${user.id}]`);
  }
}

async function getSetStatus(text?: string, emoji?: string): Promise<void> {
  if (!text) {
    // Get current status
    const data = await slackApi("users.profile.get");
    const profile = data.profile || {};
    console.log("Current status:");
    console.log(`  Text: ${profile.status_text || "(none)"}`);
    console.log(`  Emoji: ${profile.status_emoji || "(none)"}`);
    return;
  }

  // Set status
  await slackApi("users.profile.set", {
    profile: {
      status_text: text,
      status_emoji: emoji || "",
    },
  });

  console.log("Status updated!");
  console.log(`  Text: ${text}`);
  if (emoji) console.log(`  Emoji: ${emoji}`);
}

async function addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
  const channelId = await resolveChannel(channel);

  await slackApi("reactions.add", {
    channel: channelId,
    timestamp,
    name: emoji.replace(/:/g, ""),
  });

  console.log(`Reaction :${emoji.replace(/:/g, "")}: added`);
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Slack CLI - Token-efficient workspace messaging

Usage: bun SlackClient.ts <command> [args]

Commands:
  auth                      Test authentication
  channels                  List channels
  read <channel> [limit]    Read channel messages (default: 20)
  send <channel> <message>  Send message to channel
  dm <user> <message>       Send direct message
  thread <channel> <ts> <msg>  Reply in thread
  search <query>            Search messages (user token only)
  users                     List workspace users
  status [text] [emoji]     Get/set status
  react <channel> <ts> <emoji>  Add reaction

Channel formats: #general, general, C0123456789
User formats: @alice, alice, U0123456789

Examples:
  bun SlackClient.ts channels
  bun SlackClient.ts read #general 10
  bun SlackClient.ts send #engineering "Build complete!"
  bun SlackClient.ts dm @alice "Quick question..."
  bun SlackClient.ts thread #general 1234567890.123456 "Good point!"
`);
    return;
  }

  try {
    switch (command) {
      case "auth":
        await testAuth();
        break;

      case "channels":
        await listChannels();
        break;

      case "read":
        if (!args[0]) {
          console.error("Usage: read <channel> [limit]");
          process.exit(1);
        }
        await readChannel(args[0], parseInt(args[1]) || 20);
        break;

      case "send":
        if (args.length < 2) {
          console.error("Usage: send <channel> <message>");
          process.exit(1);
        }
        await sendMessage(args[0], args.slice(1).join(" "));
        break;

      case "dm":
        if (args.length < 2) {
          console.error("Usage: dm <user> <message>");
          process.exit(1);
        }
        await sendDM(args[0], args.slice(1).join(" "));
        break;

      case "thread":
        if (args.length < 3) {
          console.error("Usage: thread <channel> <timestamp> <message>");
          process.exit(1);
        }
        await replyThread(args[0], args[1], args.slice(2).join(" "));
        break;

      case "search":
        if (!args[0]) {
          console.error("Usage: search <query>");
          process.exit(1);
        }
        await searchMessages(args.join(" "));
        break;

      case "users":
        await listUsers();
        break;

      case "status":
        await getSetStatus(args[0], args[1]);
        break;

      case "react":
        if (args.length < 3) {
          console.error("Usage: react <channel> <timestamp> <emoji>");
          process.exit(1);
        }
        await addReaction(args[0], args[1], args[2]);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
