#!/usr/bin/env bun
/**
 * Telegram CLI Client
 *
 * Token-efficient Telegram integration using Bot API.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun TelegramClient.ts <command> [args]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const CONFIG_DIR = process.env.TELEGRAM_CONFIG_DIR || join(homedir(), ".config", "telegram-cli");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const CHATS_PATH = join(CONFIG_DIR, "chats.json");

const API_BASE = "https://api.telegram.org/bot";

// Types
interface Config {
  botToken: string;
  defaultChatId?: string;
}

interface ChatAliases {
  aliases: Record<string, string>;
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

// Utility functions
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadConfig(): Config {
  // Try environment variable first
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;

  if (botToken) {
    return { botToken, defaultChatId };
  }

  // Fall back to config file
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  }

  console.error("Error: No Telegram bot token found.");
  console.error("Set TELEGRAM_BOT_TOKEN environment variable,");
  console.error(`or create ${CONFIG_PATH} with token configuration.`);
  console.error("\nGet a token from @BotFather on Telegram.");
  process.exit(1);
}

function loadChatAliases(): ChatAliases {
  if (existsSync(CHATS_PATH)) {
    return JSON.parse(readFileSync(CHATS_PATH, "utf-8"));
  }
  return { aliases: {} };
}

function saveChatAliases(aliases: ChatAliases): void {
  ensureConfigDir();
  writeFileSync(CHATS_PATH, JSON.stringify(aliases, null, 2), { mode: 0o600 });
}

function getToken(): string {
  return loadConfig().botToken;
}

async function telegramApi(method: string, params: Record<string, any> = {}): Promise<any> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json() as TelegramResponse;

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description} (${data.error_code})`);
  }

  return data.result;
}

async function telegramApiForm(method: string, formData: FormData): Promise<any> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${token}/${method}`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json() as TelegramResponse;

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description} (${data.error_code})`);
  }

  return data.result;
}

// Resolve chat reference to ID
function resolveChat(chat: string): string {
  // Check if it's an alias
  const aliases = loadChatAliases();
  if (aliases.aliases[chat]) {
    return aliases.aliases[chat];
  }

  // Check for "me" alias using default chat
  if (chat === "me") {
    const config = loadConfig();
    if (config.defaultChatId) {
      return config.defaultChatId;
    }
    throw new Error("No default chat ID set. Run 'updates' to find your chat ID.");
  }

  // Return as-is (numeric ID or @username)
  return chat;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Commands
async function testAuth(): Promise<void> {
  const me = await telegramApi("getMe");
  console.log("Bot authentication successful!");
  console.log(`  Name: ${me.first_name}`);
  console.log(`  Username: @${me.username}`);
  console.log(`  Bot ID: ${me.id}`);
  console.log(`  Can join groups: ${me.can_join_groups}`);
  console.log(`  Can read messages: ${me.can_read_all_group_messages}`);
}

async function getUpdates(limit = 20): Promise<void> {
  const updates = await telegramApi("getUpdates", {
    limit,
    allowed_updates: ["message"],
  });

  console.log("\nRecent updates (messages to your bot):\n");

  if (updates.length === 0) {
    console.log("  No recent updates.");
    console.log("  Send a message to your bot to see it here.");
    return;
  }

  const chatsSeen = new Set<string>();

  for (const update of updates) {
    const msg = update.message;
    if (!msg) continue;

    const chatId = msg.chat.id.toString();
    const chatType = msg.chat.type;
    const chatName = msg.chat.title || msg.chat.first_name || chatId;
    const fromName = msg.from?.first_name || "Unknown";
    const text = msg.text || "[non-text message]";
    const date = formatDate(msg.date);

    console.log(`[${date}] ${chatName} (${chatType})`);
    console.log(`  From: ${fromName}`);
    console.log(`  Message: ${text.substring(0, 100)}`);
    console.log(`  Chat ID: ${chatId}`);
    console.log(`  Message ID: ${msg.message_id}`);
    console.log();

    chatsSeen.add(chatId);
  }

  // Suggest saving chat IDs
  if (chatsSeen.size > 0) {
    console.log("Tip: Save chat IDs as aliases:");
    console.log(`  echo '{"aliases":{"me":"${[...chatsSeen][0]}"}}' > ${CHATS_PATH}`);
  }
}

async function listChats(): Promise<void> {
  const aliases = loadChatAliases();

  console.log("\nSaved chat aliases:\n");

  if (Object.keys(aliases.aliases).length === 0) {
    console.log("  No aliases saved.");
    console.log("  Run 'updates' to discover chat IDs, then save them.");
    return;
  }

  for (const [name, id] of Object.entries(aliases.aliases)) {
    console.log(`  ${name}: ${id}`);
  }
}

async function sendMessage(chat: string, text: string, parseMode?: string): Promise<void> {
  const chatId = resolveChat(chat);

  const params: Record<string, any> = {
    chat_id: chatId,
    text,
  };

  if (parseMode) {
    params.parse_mode = parseMode === "markdown" ? "MarkdownV2" : "HTML";
  }

  const result = await telegramApi("sendMessage", params);

  console.log(`Message sent!`);
  console.log(`  Chat: ${chatId}`);
  console.log(`  Message ID: ${result.message_id}`);
}

async function replyMessage(chat: string, messageId: string, text: string): Promise<void> {
  const chatId = resolveChat(chat);

  const result = await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_to_message_id: parseInt(messageId),
  });

  console.log(`Reply sent!`);
  console.log(`  Message ID: ${result.message_id}`);
}

async function forwardMessage(fromChat: string, toChat: string, messageId: string): Promise<void> {
  const fromChatId = resolveChat(fromChat);
  const toChatId = resolveChat(toChat);

  const result = await telegramApi("forwardMessage", {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: parseInt(messageId),
  });

  console.log(`Message forwarded!`);
  console.log(`  New Message ID: ${result.message_id}`);
}

async function sendPhoto(chat: string, filePath: string, caption?: string): Promise<void> {
  const chatId = resolveChat(chat);

  const file = Bun.file(filePath);
  if (!await file.exists()) {
    throw new Error(`File not found: ${filePath}`);
  }

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", file);
  if (caption) {
    formData.append("caption", caption);
  }

  const result = await telegramApiForm("sendPhoto", formData);

  console.log(`Photo sent!`);
  console.log(`  Message ID: ${result.message_id}`);
}

async function sendDocument(chat: string, filePath: string, caption?: string): Promise<void> {
  const chatId = resolveChat(chat);

  const file = Bun.file(filePath);
  if (!await file.exists()) {
    throw new Error(`File not found: ${filePath}`);
  }

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", file);
  if (caption) {
    formData.append("caption", caption);
  }

  const result = await telegramApiForm("sendDocument", formData);

  console.log(`Document sent!`);
  console.log(`  Message ID: ${result.message_id}`);
}

async function deleteMessage(chat: string, messageId: string): Promise<void> {
  const chatId = resolveChat(chat);

  await telegramApi("deleteMessage", {
    chat_id: chatId,
    message_id: parseInt(messageId),
  });

  console.log(`Message ${messageId} deleted.`);
}

async function getBotInfo(): Promise<void> {
  const me = await telegramApi("getMe");
  console.log("\nBot Info:\n");
  console.log(`  ID: ${me.id}`);
  console.log(`  Name: ${me.first_name}`);
  console.log(`  Username: @${me.username}`);
  console.log(`  Can join groups: ${me.can_join_groups}`);
  console.log(`  Can read all messages: ${me.can_read_all_group_messages}`);
  console.log(`  Supports inline queries: ${me.supports_inline_queries}`);
}

async function setWebhook(url: string): Promise<void> {
  await telegramApi("setWebhook", { url });
  console.log(`Webhook set to: ${url}`);
}

async function deleteWebhook(): Promise<void> {
  await telegramApi("deleteWebhook");
  console.log("Webhook deleted. Using polling mode.");
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Telegram CLI - Token-efficient personal messaging

Usage: bun TelegramClient.ts <command> [args]

Commands:
  auth                      Test bot token
  updates [limit]           Get recent updates (default: 20)
  chats                     List saved chat aliases
  send <chat> <message>     Send message
  reply <chat> <msg_id> <text>  Reply to message
  forward <from> <to> <msg_id>  Forward message
  photo <chat> <path> [caption]  Send photo
  file <chat> <path> [caption]   Send document
  delete <chat> <msg_id>    Delete message
  me                        Get bot info
  webhook set <url>         Set webhook URL
  webhook delete            Remove webhook

Chat formats: numeric ID, @username, or alias from chats.json
Special alias: "me" uses TELEGRAM_CHAT_ID or default from config

Examples:
  bun TelegramClient.ts auth
  bun TelegramClient.ts updates
  bun TelegramClient.ts send me "Hello from CLI!"
  bun TelegramClient.ts send 123456789 "Direct message"
  bun TelegramClient.ts photo me ./image.jpg "Check this out"
`);
    return;
  }

  try {
    switch (command) {
      case "auth":
        await testAuth();
        break;

      case "updates":
        await getUpdates(parseInt(args[0]) || 20);
        break;

      case "chats":
        await listChats();
        break;

      case "send":
        if (args.length < 2) {
          console.error("Usage: send <chat> <message>");
          process.exit(1);
        }
        const parseMode = args.includes("--parse") ? args[args.indexOf("--parse") + 1] : undefined;
        const msgArgs = args.filter((a, i) => a !== "--parse" && args[i - 1] !== "--parse");
        await sendMessage(msgArgs[0], msgArgs.slice(1).join(" "), parseMode);
        break;

      case "reply":
        if (args.length < 3) {
          console.error("Usage: reply <chat> <message_id> <text>");
          process.exit(1);
        }
        await replyMessage(args[0], args[1], args.slice(2).join(" "));
        break;

      case "forward":
        if (args.length < 3) {
          console.error("Usage: forward <from_chat> <to_chat> <message_id>");
          process.exit(1);
        }
        await forwardMessage(args[0], args[1], args[2]);
        break;

      case "photo":
        if (args.length < 2) {
          console.error("Usage: photo <chat> <file_path> [caption]");
          process.exit(1);
        }
        await sendPhoto(args[0], args[1], args.slice(2).join(" ") || undefined);
        break;

      case "file":
        if (args.length < 2) {
          console.error("Usage: file <chat> <file_path> [caption]");
          process.exit(1);
        }
        await sendDocument(args[0], args[1], args.slice(2).join(" ") || undefined);
        break;

      case "delete":
        if (args.length < 2) {
          console.error("Usage: delete <chat> <message_id>");
          process.exit(1);
        }
        await deleteMessage(args[0], args[1]);
        break;

      case "me":
        await getBotInfo();
        break;

      case "webhook":
        if (args[0] === "set" && args[1]) {
          await setWebhook(args[1]);
        } else if (args[0] === "delete") {
          await deleteWebhook();
        } else {
          console.error("Usage: webhook set <url> | webhook delete");
          process.exit(1);
        }
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
