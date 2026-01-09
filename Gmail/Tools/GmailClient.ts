#!/usr/bin/env bun
/**
 * Gmail CLI Client
 *
 * Token-efficient Gmail integration using direct API calls.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun GmailClient.ts <command> [args]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const CONFIG_DIR = process.env.GMAIL_CONFIG_DIR || join(homedir(), ".config", "gmail-cli");
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS || join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = process.env.GMAIL_TOKEN || join(CONFIG_DIR, "token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Types
interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface Token {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface Message {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate?: string;
}

// Utility functions
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`Error: credentials.json not found at ${CREDENTIALS_PATH}`);
    console.error("Run the Setup workflow to configure OAuth credentials.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function loadToken(): Token | null {
  if (!existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

function saveToken(token: Token): void {
  ensureConfigDir();
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function getClientConfig(creds: Credentials) {
  const config = creds.installed || creds.web;
  if (!config) {
    throw new Error("Invalid credentials format");
  }
  return config;
}

// OAuth flow
async function authenticate(): Promise<void> {
  const creds = loadCredentials();
  const { client_id, client_secret, redirect_uris } = getClientConfig(creds);

  // Use localhost callback for desktop flow
  const redirectUri = redirect_uris.find(u => u.includes("localhost")) || "http://localhost:3000/oauth2callback";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl.toString());
  console.log("\n2. After authorization, you'll be redirected to localhost.");
  console.log("   Copy the 'code' parameter from the URL.\n");

  const code = await promptForInput("3. Paste the authorization code here: ");

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  const token: Token = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: Date.now() + tokenData.expires_in * 1000,
  };

  saveToken(token);
  console.log("\nAuthentication successful! Token saved to:", TOKEN_PATH);
}

async function promptForInput(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  for await (const line of console) {
    return line.trim();
  }
  throw new Error("No input received");
}

// Token refresh
async function refreshAccessToken(token: Token): Promise<Token> {
  const creds = loadCredentials();
  const { client_id, client_secret } = getClientConfig(creds);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed. Run 'auth' command to re-authenticate.");
  }

  const data = await response.json();
  const newToken: Token = {
    access_token: data.access_token,
    refresh_token: token.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };

  saveToken(newToken);
  return newToken;
}

async function getValidToken(): Promise<string> {
  let token = loadToken();

  if (!token) {
    console.error("Not authenticated. Run: bun GmailClient.ts auth");
    process.exit(1);
  }

  // Refresh if expired (with 5 min buffer)
  if (Date.now() > token.expiry_date - 5 * 60 * 1000) {
    token = await refreshAccessToken(token);
  }

  return token.access_token;
}

// API helpers
async function gmailFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getValidToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${error}`);
  }

  return response.json();
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getHeader(message: Message, name: string): string {
  const header = message.payload?.headers?.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

function getMessageBody(message: Message): string {
  // Try direct body
  if (message.payload?.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }

  // Try parts (multipart messages)
  const parts = message.payload?.parts || [];

  // Prefer text/plain
  const textPart = parts.find(p => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data);
  }

  // Fall back to text/html
  const htmlPart = parts.find(p => p.mimeType === "text/html");
  if (htmlPart?.body?.data) {
    // Strip HTML tags for CLI display
    const html = decodeBase64Url(htmlPart.body.data);
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  return "[No readable content]";
}

// Commands
async function listUnread(maxResults = 20): Promise<void> {
  const data = await gmailFetch(
    `/messages?q=is:unread&maxResults=${maxResults}`
  );

  if (!data.messages || data.messages.length === 0) {
    console.log("No unread messages.");
    return;
  }

  console.log(`\nUnread messages (${data.resultSizeEstimate} total):\n`);

  for (const msg of data.messages.slice(0, maxResults)) {
    const details = await gmailFetch(`/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    const from = getHeader(details, "From");
    const subject = getHeader(details, "Subject") || "(no subject)";
    const date = new Date(parseInt(details.internalDate)).toLocaleDateString();

    console.log(`[${msg.id}] ${date}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log();
  }
}

async function searchMessages(query: string, maxResults = 20): Promise<void> {
  const data = await gmailFetch(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  );

  if (!data.messages || data.messages.length === 0) {
    console.log(`No messages matching: ${query}`);
    return;
  }

  console.log(`\nSearch results for "${query}" (${data.resultSizeEstimate} matches):\n`);

  for (const msg of data.messages.slice(0, maxResults)) {
    const details = await gmailFetch(`/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    const from = getHeader(details, "From");
    const subject = getHeader(details, "Subject") || "(no subject)";
    const date = new Date(parseInt(details.internalDate)).toLocaleDateString();

    console.log(`[${msg.id}] ${date}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log();
  }
}

async function readMessage(messageId: string): Promise<void> {
  const message = await gmailFetch(`/messages/${messageId}?format=full`);

  const from = getHeader(message, "From");
  const to = getHeader(message, "To");
  const subject = getHeader(message, "Subject");
  const date = getHeader(message, "Date");
  const body = getMessageBody(message);

  console.log("\n" + "=".repeat(60));
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Date: ${date}`);
  console.log(`Subject: ${subject}`);
  console.log(`Labels: ${message.labelIds?.join(", ") || "none"}`);
  console.log("=".repeat(60));
  console.log();
  console.log(body);
  console.log();
}

async function sendMessage(to: string, subject: string, body: string): Promise<void> {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const raw = encodeBase64Url(message);

  const result = await gmailFetch("/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });

  console.log(`Message sent! ID: ${result.id}`);
}

async function replyToMessage(messageId: string, body: string): Promise<void> {
  const original = await gmailFetch(`/messages/${messageId}?format=full`);

  const from = getHeader(original, "From");
  const subject = getHeader(original, "Subject");
  const messageIdHeader = getHeader(original, "Message-ID");
  const references = getHeader(original, "References");

  // Extract email from "Name <email>" format
  const toMatch = from.match(/<([^>]+)>/) || [null, from];
  const to = toMatch[1];

  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  const message = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageIdHeader}`,
    `References: ${references ? references + " " : ""}${messageIdHeader}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
    "",
    `On ${getHeader(original, "Date")}, ${from} wrote:`,
    getMessageBody(original).split("\n").map(line => `> ${line}`).join("\n"),
  ].join("\r\n");

  const raw = encodeBase64Url(message);

  const result = await gmailFetch("/messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw,
      threadId: original.threadId,
    }),
  });

  console.log(`Reply sent! ID: ${result.id}`);
}

async function listLabels(): Promise<void> {
  const data = await gmailFetch("/labels");

  console.log("\nLabels:\n");
  for (const label of data.labels) {
    const type = label.type === "system" ? "(system)" : "";
    console.log(`  ${label.name} ${type}`);
  }
}

async function applyLabel(messageId: string, labelName: string): Promise<void> {
  // First, find the label ID
  const labelsData = await gmailFetch("/labels");
  const label = labelsData.labels.find(
    (l: any) => l.name.toLowerCase() === labelName.toLowerCase()
  );

  if (!label) {
    console.error(`Label not found: ${labelName}`);
    console.log("Available labels:");
    labelsData.labels.forEach((l: any) => console.log(`  ${l.name}`));
    return;
  }

  await gmailFetch(`/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [label.id],
    }),
  });

  console.log(`Label "${labelName}" applied to message ${messageId}`);
}

async function archiveMessage(messageId: string): Promise<void> {
  await gmailFetch(`/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      removeLabelIds: ["INBOX"],
    }),
  });

  console.log(`Message ${messageId} archived`);
}

async function trashMessage(messageId: string): Promise<void> {
  await gmailFetch(`/messages/${messageId}/trash`, {
    method: "POST",
  });

  console.log(`Message ${messageId} moved to trash`);
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Gmail CLI - Token-efficient email management

Usage: bun GmailClient.ts <command> [args]

Commands:
  auth                    Authenticate with Gmail
  unread [max]           List unread messages (default: 20)
  search <query> [max]   Search messages using Gmail syntax
  read <messageId>       Read full message
  send <to> <subject>    Send message (body from stdin)
  reply <messageId>      Reply to message (body from stdin)
  labels                 List all labels
  label <id> <label>     Apply label to message
  archive <id>           Archive message (remove from inbox)
  trash <id>             Move message to trash

Examples:
  bun GmailClient.ts unread
  bun GmailClient.ts search "from:alice is:unread"
  bun GmailClient.ts read 18d5a3b2c1f0e9d8
  echo "Thanks!" | bun GmailClient.ts reply 18d5a3b2c1f0e9d8
`);
    return;
  }

  try {
    switch (command) {
      case "auth":
        await authenticate();
        break;

      case "unread":
        await listUnread(parseInt(args[0]) || 20);
        break;

      case "search":
        if (!args[0]) {
          console.error("Usage: search <query> [maxResults]");
          process.exit(1);
        }
        await searchMessages(args[0], parseInt(args[1]) || 20);
        break;

      case "read":
        if (!args[0]) {
          console.error("Usage: read <messageId>");
          process.exit(1);
        }
        await readMessage(args[0]);
        break;

      case "send":
        if (args.length < 2) {
          console.error("Usage: echo 'body' | send <to> <subject>");
          process.exit(1);
        }
        const sendBody = await Bun.stdin.text();
        await sendMessage(args[0], args[1], sendBody.trim());
        break;

      case "reply":
        if (!args[0]) {
          console.error("Usage: echo 'body' | reply <messageId>");
          process.exit(1);
        }
        const replyBody = await Bun.stdin.text();
        await replyToMessage(args[0], replyBody.trim());
        break;

      case "labels":
        await listLabels();
        break;

      case "label":
        if (args.length < 2) {
          console.error("Usage: label <messageId> <labelName>");
          process.exit(1);
        }
        await applyLabel(args[0], args[1]);
        break;

      case "archive":
        if (!args[0]) {
          console.error("Usage: archive <messageId>");
          process.exit(1);
        }
        await archiveMessage(args[0]);
        break;

      case "trash":
        if (!args[0]) {
          console.error("Usage: trash <messageId>");
          process.exit(1);
        }
        await trashMessage(args[0]);
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
