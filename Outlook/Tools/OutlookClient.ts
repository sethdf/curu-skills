#!/usr/bin/env bun
/**
 * Outlook CLI Client
 *
 * Token-efficient Microsoft 365 email integration using Graph API.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun OutlookClient.ts <command> [args]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const CONFIG_DIR = process.env.OUTLOOK_CONFIG_DIR || join(homedir(), ".config", "outlook-cli");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");

const SCOPES = ["Mail.Read", "Mail.Send", "Mail.ReadWrite", "User.Read", "offline_access"];
const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";

// Types
interface Credentials {
  clientId: string;
  clientSecret?: string;
  tenantId: string;
}

interface Token {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface Message {
  id: string;
  subject: string;
  from?: { emailAddress: { name: string; address: string } };
  toRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  body?: { content: string; contentType: string };
  bodyPreview?: string;
}

// Utility functions
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_PATH)) {
    // Try environment variables
    const clientId = process.env.MS_CLIENT_ID;
    const tenantId = process.env.MS_TENANT_ID || "common";

    if (clientId) {
      return { clientId, tenantId, clientSecret: process.env.MS_CLIENT_SECRET };
    }

    console.error(`Error: No credentials found.`);
    console.error(`Either set MS_CLIENT_ID environment variable or create ${CREDENTIALS_PATH}`);
    console.error("Run the Setup workflow to configure Azure app registration.");
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

// Device code flow authentication
async function authenticate(): Promise<void> {
  const creds = loadCredentials();

  // Start device code flow
  const deviceCodeResponse = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        scope: SCOPES.join(" "),
      }),
    }
  );

  if (!deviceCodeResponse.ok) {
    throw new Error(`Device code request failed: ${await deviceCodeResponse.text()}`);
  }

  const deviceCode = await deviceCodeResponse.json();

  console.log("\n" + "=".repeat(60));
  console.log("To sign in, open a browser and go to:");
  console.log(`\n  ${deviceCode.verification_uri}\n`);
  console.log(`Enter the code: ${deviceCode.user_code}`);
  console.log("=".repeat(60));
  console.log("\nWaiting for authentication...");

  // Poll for token
  const interval = deviceCode.interval * 1000;
  const expiresAt = Date.now() + deviceCode.expires_in * 1000;

  while (Date.now() < expiresAt) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode.device_code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      const token: Token = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + tokenData.expires_in * 1000,
      };
      saveToken(token);
      console.log("\nAuthentication successful! Token saved.");
      return;
    }

    if (tokenData.error !== "authorization_pending") {
      throw new Error(`Authentication failed: ${tokenData.error_description}`);
    }
  }

  throw new Error("Authentication timed out");
}

async function refreshAccessToken(token: Token): Promise<Token> {
  const creds = loadCredentials();

  const response = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
        scope: SCOPES.join(" "),
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Token refresh failed. Run 'auth' command to re-authenticate.");
  }

  const data = await response.json();
  const newToken: Token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveToken(newToken);
  return newToken;
}

async function getValidToken(): Promise<string> {
  let token = loadToken();

  if (!token) {
    console.error("Not authenticated. Run: bun OutlookClient.ts auth");
    process.exit(1);
  }

  if (Date.now() > token.expires_at - 5 * 60 * 1000) {
    token = await refreshAccessToken(token);
  }

  return token.access_token;
}

async function graphFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getValidToken();

  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error (${response.status}): ${error}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Commands
async function listUnread(maxResults = 20): Promise<void> {
  const data = await graphFetch(
    `/messages?$filter=isRead eq false&$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments`
  );

  if (!data.value || data.value.length === 0) {
    console.log("No unread messages.");
    return;
  }

  console.log(`\nUnread messages:\n`);

  for (const msg of data.value) {
    const from = msg.from?.emailAddress?.address || "unknown";
    const name = msg.from?.emailAddress?.name || from;
    const date = formatDate(msg.receivedDateTime);
    const attachment = msg.hasAttachments ? " [+]" : "";

    console.log(`[${msg.id.substring(0, 12)}...] ${date}`);
    console.log(`  From: ${name} <${from}>`);
    console.log(`  Subject: ${msg.subject || "(no subject)"}${attachment}`);
    console.log();
  }
}

async function searchMessages(query: string, maxResults = 20): Promise<void> {
  // Try OData filter first, fall back to $search
  let endpoint: string;
  if (query.includes(" eq ") || query.includes(" ne ") || query.includes("/")) {
    endpoint = `/messages?$filter=${encodeURIComponent(query)}&$top=${maxResults}&$orderby=receivedDateTime desc`;
  } else {
    endpoint = `/messages?$search="${encodeURIComponent(query)}"&$top=${maxResults}`;
  }

  const data = await graphFetch(endpoint);

  if (!data.value || data.value.length === 0) {
    console.log(`No messages matching: ${query}`);
    return;
  }

  console.log(`\nSearch results for "${query}":\n`);

  for (const msg of data.value) {
    const from = msg.from?.emailAddress?.address || "unknown";
    const date = formatDate(msg.receivedDateTime);

    console.log(`[${msg.id.substring(0, 12)}...] ${date}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${msg.subject || "(no subject)"}`);
    console.log();
  }
}

async function readMessage(messageId: string): Promise<void> {
  const message = await graphFetch(`/messages/${messageId}`);

  const from = message.from?.emailAddress;
  const to = message.toRecipients?.map((r: any) => r.emailAddress.address).join(", ");
  const body = message.body?.contentType === "html"
    ? stripHtml(message.body.content)
    : message.body?.content || "[No content]";

  console.log("\n" + "=".repeat(60));
  console.log(`From: ${from?.name} <${from?.address}>`);
  console.log(`To: ${to}`);
  console.log(`Date: ${formatDate(message.receivedDateTime)}`);
  console.log(`Subject: ${message.subject}`);
  console.log("=".repeat(60));
  console.log();
  console.log(body);
  console.log();

  // Mark as read
  await graphFetch(`/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  });
}

async function sendMessage(to: string, subject: string, body: string): Promise<void> {
  const message = {
    message: {
      subject,
      body: { contentType: "Text", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    },
  };

  await graphFetch("/sendMail", {
    method: "POST",
    body: JSON.stringify(message),
  });

  console.log(`Message sent to ${to}!`);
}

async function replyToMessage(messageId: string, body: string): Promise<void> {
  await graphFetch(`/messages/${messageId}/reply`, {
    method: "POST",
    body: JSON.stringify({
      comment: body,
    }),
  });

  console.log("Reply sent!");
}

async function listFolders(): Promise<void> {
  const data = await graphFetch("/mailFolders?$top=50");

  console.log("\nMail Folders:\n");
  for (const folder of data.value) {
    const unread = folder.unreadItemCount > 0 ? ` (${folder.unreadItemCount} unread)` : "";
    console.log(`  ${folder.displayName}${unread} [${folder.id.substring(0, 12)}...]`);
  }
}

async function moveMessage(messageId: string, folderId: string): Promise<void> {
  // Try to find folder by name first
  const foldersData = await graphFetch("/mailFolders?$top=50");
  const folder = foldersData.value.find(
    (f: any) => f.displayName.toLowerCase() === folderId.toLowerCase() || f.id === folderId
  );

  const targetId = folder?.id || folderId;

  await graphFetch(`/messages/${messageId}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: targetId }),
  });

  console.log(`Message moved to ${folder?.displayName || folderId}`);
}

async function archiveMessage(messageId: string): Promise<void> {
  await moveMessage(messageId, "archive");
}

async function deleteMessage(messageId: string): Promise<void> {
  await graphFetch(`/messages/${messageId}`, { method: "DELETE" });
  console.log("Message deleted");
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Outlook CLI - Token-efficient M365 email management

Usage: bun OutlookClient.ts <command> [args]

Commands:
  auth                    Authenticate with Microsoft 365
  unread [max]           List unread messages (default: 20)
  search <query> [max]   Search messages (OData or KQL)
  read <messageId>       Read full message
  send <to> <subject>    Send message (body from stdin)
  reply <messageId>      Reply to message (body from stdin)
  folders                List mail folders
  move <id> <folder>     Move message to folder
  archive <id>           Archive message
  delete <id>            Delete message

Examples:
  bun OutlookClient.ts unread
  bun OutlookClient.ts search "subject:urgent"
  bun OutlookClient.ts read AAMkAG...
  echo "Thanks!" | bun OutlookClient.ts reply AAMkAG...
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

      case "folders":
        await listFolders();
        break;

      case "move":
        if (args.length < 2) {
          console.error("Usage: move <messageId> <folderId|folderName>");
          process.exit(1);
        }
        await moveMessage(args[0], args[1]);
        break;

      case "archive":
        if (!args[0]) {
          console.error("Usage: archive <messageId>");
          process.exit(1);
        }
        await archiveMessage(args[0]);
        break;

      case "delete":
        if (!args[0]) {
          console.error("Usage: delete <messageId>");
          process.exit(1);
        }
        await deleteMessage(args[0]);
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
