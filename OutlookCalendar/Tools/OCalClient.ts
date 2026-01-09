#!/usr/bin/env bun
/**
 * Outlook Calendar CLI Client
 *
 * Token-efficient Microsoft 365 Calendar integration using Graph API.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun OCalClient.ts <command> [args]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration - shares auth with Outlook email
const CONFIG_DIR = process.env.OUTLOOK_CONFIG_DIR || join(homedir(), ".config", "outlook-cli");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");

const CALENDAR_SCOPES = [
  "Calendars.Read",
  "Calendars.ReadWrite",
  "OnlineMeetings.ReadWrite",
  "User.Read",
  "offline_access",
];

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

interface CalendarEvent {
  id: string;
  subject: string;
  body?: { content: string; contentType: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: Array<{ emailAddress: { name: string; address: string }; status: { response: string } }>;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl: string };
  webLink?: string;
}

// Utility functions
function loadCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_PATH)) {
    const clientId = process.env.MS_CLIENT_ID;
    const tenantId = process.env.MS_TENANT_ID || "common";
    if (clientId) {
      return { clientId, tenantId, clientSecret: process.env.MS_CLIENT_SECRET };
    }
    console.error(`Error: No credentials. Set MS_CLIENT_ID or create ${CREDENTIALS_PATH}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function loadToken(): Token | null {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

function saveToken(token: Token): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

// Device code flow with calendar scopes
async function authenticate(): Promise<void> {
  const creds = loadCredentials();

  // Include both mail and calendar scopes
  const allScopes = [
    "Mail.Read", "Mail.Send", "Mail.ReadWrite",
    ...CALENDAR_SCOPES,
  ];

  const deviceCodeResponse = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        scope: allScopes.join(" "),
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
      saveToken({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + tokenData.expires_in * 1000,
      });
      console.log("\nAuthentication successful! Calendar scopes added.");
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
      }),
    }
  );

  if (!response.ok) throw new Error("Token refresh failed");

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
    console.error("Not authenticated. Run: bun OCalClient.ts auth");
    process.exit(1);
  }
  if (Date.now() > token.expires_at - 5 * 60 * 1000) {
    token = await refreshAccessToken(token);
  }
  return token.access_token;
}

async function graphFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getValidToken();
  const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Graph API error (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Date utilities
function parseDate(input: string): Date {
  const now = new Date();
  const lower = input.toLowerCase();

  if (lower === "today") return now;
  if (lower === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = days.indexOf(lower);
  if (dayIndex !== -1) {
    const d = new Date(now);
    const diff = (dayIndex - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  return new Date(input);
}

function parseTime(input: string): { hours: number; minutes: number } {
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) throw new Error(`Invalid time: ${input}`);

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || "0");
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

function parseDuration(input: string): number {
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|hour)?$/i);
  if (!match) throw new Error(`Invalid duration: ${input}`);

  const value = parseFloat(match[1]);
  const unit = match[2]?.toLowerCase() || "m";

  if (unit.startsWith("h")) return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// Commands
async function showToday(): Promise<void> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const data = await graphFetch(
    `/calendar/calendarView?startDateTime=${startOfDay.toISOString()}&endDateTime=${endOfDay.toISOString()}&$orderby=start/dateTime&$top=50`
  );

  console.log(`\nToday's Schedule (${now.toLocaleDateString()}):\n`);

  if (!data.value || data.value.length === 0) {
    console.log("  No events scheduled.");
    return;
  }

  for (const event of data.value) {
    const time = formatEventTime(event);
    const location = event.location?.displayName ? ` @ ${event.location.displayName}` : "";
    const teams = event.isOnlineMeeting ? " [Teams]" : "";

    console.log(`  ${time}${teams}`);
    console.log(`    ${event.subject}${location}`);
    if (event.onlineMeeting?.joinUrl) {
      console.log(`    Join: ${event.onlineMeeting.joinUrl}`);
    }
    console.log();
  }
}

async function showWeek(): Promise<void> {
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const data = await graphFetch(
    `/calendar/calendarView?startDateTime=${now.toISOString()}&endDateTime=${endOfWeek.toISOString()}&$orderby=start/dateTime&$top=100`
  );

  console.log(`\nThis Week's Schedule:\n`);

  if (!data.value || data.value.length === 0) {
    console.log("  No events scheduled.");
    return;
  }

  let currentDay = "";
  for (const event of data.value) {
    const eventDate = new Date(event.start.dateTime);
    const dayStr = eventDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    if (dayStr !== currentDay) {
      currentDay = dayStr;
      console.log(`${dayStr}:`);
    }

    const time = formatEventTime(event);
    const teams = event.isOnlineMeeting ? " [Teams]" : "";
    console.log(`  ${time} - ${event.subject}${teams}`);
  }
}

async function findFreeSlots(days = 7): Promise<void> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Use findMeetingTimes API for accurate free/busy
  const data = await graphFetch(
    `/calendar/calendarView?startDateTime=${now.toISOString()}&endDateTime=${end.toISOString()}&$orderby=start/dateTime&$top=200`
  );

  console.log(`\nFree Slots (next ${days} days, 8am-6pm):\n`);

  const events = data.value || [];
  const workStart = 8;
  const workEnd = 18;

  for (let d = 0; d < days; d++) {
    const day = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workStart);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workEnd);

    const dayEvents = events.filter((e: CalendarEvent) => {
      const eStart = new Date(e.start.dateTime);
      return eStart >= dayStart && eStart < dayEnd;
    });

    const freeSlots: string[] = [];
    let slotStart = dayStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      if (eventStart > slotStart) {
        const duration = (eventStart.getTime() - slotStart.getTime()) / (60 * 1000);
        if (duration >= 30) {
          freeSlots.push(
            `${slotStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${eventStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${Math.round(duration)}m)`
          );
        }
      }
      slotStart = eventEnd > slotStart ? eventEnd : slotStart;
    }

    if (slotStart < dayEnd) {
      const duration = (dayEnd.getTime() - slotStart.getTime()) / (60 * 1000);
      if (duration >= 30) {
        freeSlots.push(
          `${slotStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${dayEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${Math.round(duration)}m)`
        );
      }
    }

    if (freeSlots.length > 0) {
      console.log(`${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}:`);
      freeSlots.forEach(slot => console.log(`  ${slot}`));
    }
  }
}

async function createEvent(title: string, dateStr: string, timeStr: string, durationStr: string, attendees?: string, withTeams = false): Promise<void> {
  const date = parseDate(dateStr);
  const time = parseTime(timeStr);
  const duration = parseDuration(durationStr);

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours, time.minutes);
  const end = new Date(start.getTime() + duration);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const event: any = {
    subject: title,
    start: { dateTime: start.toISOString().slice(0, -1), timeZone },
    end: { dateTime: end.toISOString().slice(0, -1), timeZone },
  };

  if (attendees) {
    event.attendees = attendees.split(",").map(email => ({
      emailAddress: { address: email.trim() },
      type: "required",
    }));
  }

  if (withTeams) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }

  const result = await graphFetch("/calendar/events", {
    method: "POST",
    body: JSON.stringify(event),
  });

  console.log(`Event created: ${result.subject}`);
  console.log(`  When: ${start.toLocaleString()} - ${end.toLocaleTimeString()}`);
  if (result.onlineMeeting?.joinUrl) {
    console.log(`  Teams: ${result.onlineMeeting.joinUrl}`);
  }
  console.log(`  Link: ${result.webLink}`);
}

async function respondToEvent(eventId: string, response: "accept" | "decline" | "tentativelyAccept"): Promise<void> {
  await graphFetch(`/calendar/events/${eventId}/${response}`, {
    method: "POST",
    body: JSON.stringify({ sendResponse: true }),
  });
  console.log(`Response sent: ${response}`);
}

async function deleteEvent(eventId: string): Promise<void> {
  await graphFetch(`/calendar/events/${eventId}`, { method: "DELETE" });
  console.log("Event deleted/cancelled.");
}

async function listCalendars(): Promise<void> {
  const data = await graphFetch("/calendars");

  console.log("\nCalendars:\n");
  for (const cal of data.value) {
    const owner = cal.isDefaultCalendar ? " (default)" : "";
    console.log(`  ${cal.name}${owner}`);
    console.log(`    ID: ${cal.id.substring(0, 20)}...`);
  }
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Outlook Calendar CLI - Token-efficient M365 calendar management

Usage: bun OCalClient.ts <command> [args]

Commands:
  auth                          Re-authenticate with calendar scopes
  today                         Show today's events
  week                          Show this week's events
  free [days]                   Find free slots (default: 7)
  create <title> <date> <time> <duration> [attendees]
  teams <title> <date> <time> <duration> [attendees]  Create with Teams link
  accept <eventId>              Accept meeting
  decline <eventId>             Decline meeting
  tentative <eventId>           Tentatively accept
  delete <eventId>              Delete/cancel event
  calendars                     List calendars

Date formats: today, tomorrow, monday, 2024-01-15
Time formats: 2pm, 14:00, 9:30am
Duration formats: 30m, 1h, 1.5h

Examples:
  bun OCalClient.ts today
  bun OCalClient.ts teams "Sprint Planning" monday 10am 1h "alice@company.com"
  bun OCalClient.ts free 5
  bun OCalClient.ts accept AAMkAG...
`);
    return;
  }

  try {
    switch (command) {
      case "auth":
        await authenticate();
        break;
      case "today":
        await showToday();
        break;
      case "week":
        await showWeek();
        break;
      case "free":
        await findFreeSlots(parseInt(args[0]) || 7);
        break;
      case "create":
        if (args.length < 4) {
          console.error("Usage: create <title> <date> <time> <duration> [attendees]");
          process.exit(1);
        }
        await createEvent(args[0], args[1], args[2], args[3], args[4], false);
        break;
      case "teams":
        if (args.length < 4) {
          console.error("Usage: teams <title> <date> <time> <duration> [attendees]");
          process.exit(1);
        }
        await createEvent(args[0], args[1], args[2], args[3], args[4], true);
        break;
      case "accept":
        if (!args[0]) { console.error("Usage: accept <eventId>"); process.exit(1); }
        await respondToEvent(args[0], "accept");
        break;
      case "decline":
        if (!args[0]) { console.error("Usage: decline <eventId>"); process.exit(1); }
        await respondToEvent(args[0], "decline");
        break;
      case "tentative":
        if (!args[0]) { console.error("Usage: tentative <eventId>"); process.exit(1); }
        await respondToEvent(args[0], "tentativelyAccept");
        break;
      case "delete":
        if (!args[0]) { console.error("Usage: delete <eventId>"); process.exit(1); }
        await deleteEvent(args[0]);
        break;
      case "calendars":
        await listCalendars();
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
