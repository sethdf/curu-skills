#!/usr/bin/env bun
/**
 * Google Calendar CLI Client
 *
 * Token-efficient Google Calendar integration using Calendar API.
 * Designed for use with Claude Code skills.
 *
 * Usage: bun GCalClient.ts <command> [args]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration - shares auth with Gmail
const CONFIG_DIR = process.env.GMAIL_CONFIG_DIR || join(homedir(), ".config", "gmail-cli");
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS || join(CONFIG_DIR, "credentials.json");
const TOKEN_PATH = process.env.GMAIL_TOKEN || join(CONFIG_DIR, "token.json");

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const API_BASE = "https://www.googleapis.com/calendar/v3";

// Types
interface Credentials {
  installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris: string[] };
}

interface Token {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; responseStatus: string }>;
  htmlLink?: string;
}

// Utility functions
function loadCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_PATH)) {
    console.error(`Error: credentials.json not found at ${CREDENTIALS_PATH}`);
    console.error("Set up Gmail OAuth first, then re-auth with calendar scopes.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function loadToken(): Token | null {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
}

function saveToken(token: Token): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function getClientConfig(creds: Credentials) {
  return creds.installed || creds.web;
}

// OAuth (extends existing Gmail token with calendar scopes)
async function authenticate(): Promise<void> {
  const creds = loadCredentials();
  const config = getClientConfig(creds);
  if (!config) throw new Error("Invalid credentials format");

  const { client_id, client_secret, redirect_uris } = config;
  const redirectUri = redirect_uris.find(u => u.includes("localhost")) || "http://localhost:3000/oauth2callback";

  // Request both Gmail and Calendar scopes
  const allScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    ...CALENDAR_SCOPES,
  ];

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", allScopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl.toString());
  console.log("\n2. After authorization, paste the code from the URL.\n");

  process.stdout.write("3. Authorization code: ");
  let code = "";
  for await (const line of console) {
    code = line.trim();
    break;
  }

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
    throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
  }

  const tokenData = await tokenResponse.json();
  saveToken({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: Date.now() + tokenData.expires_in * 1000,
  });

  console.log("\nAuthentication successful! Calendar scopes added.");
}

async function refreshAccessToken(token: Token): Promise<Token> {
  const creds = loadCredentials();
  const config = getClientConfig(creds);
  if (!config) throw new Error("Invalid credentials");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) throw new Error("Token refresh failed");

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
    console.error("Not authenticated. Run: bun GCalClient.ts auth");
    process.exit(1);
  }
  if (Date.now() > token.expiry_date - 5 * 60 * 1000) {
    token = await refreshAccessToken(token);
  }
  return token.access_token;
}

async function calendarFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getValidToken();
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error (${response.status}): ${error}`);
  }

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
  if (event.start.date) {
    return `All day: ${event.start.date}`;
  }
  const start = new Date(event.start.dateTime!);
  const end = new Date(event.end.dateTime!);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// Commands
async function showToday(): Promise<void> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const data = await calendarFetch(
    `/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`
  );

  console.log(`\nToday's Schedule (${now.toLocaleDateString()}):\n`);

  if (!data.items || data.items.length === 0) {
    console.log("  No events scheduled.");
    return;
  }

  for (const event of data.items) {
    const time = formatEventTime(event);
    const location = event.location ? ` @ ${event.location}` : "";
    console.log(`  ${time}`);
    console.log(`    ${event.summary}${location}`);
    if (event.attendees?.length) {
      console.log(`    Attendees: ${event.attendees.length}`);
    }
    console.log();
  }
}

async function showWeek(): Promise<void> {
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const data = await calendarFetch(
    `/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${endOfWeek.toISOString()}&singleEvents=true&orderBy=startTime`
  );

  console.log(`\nThis Week's Schedule:\n`);

  if (!data.items || data.items.length === 0) {
    console.log("  No events scheduled.");
    return;
  }

  let currentDay = "";
  for (const event of data.items) {
    const eventDate = new Date(event.start.dateTime || event.start.date);
    const dayStr = eventDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    if (dayStr !== currentDay) {
      currentDay = dayStr;
      console.log(`${dayStr}:`);
    }

    const time = formatEventTime(event);
    console.log(`  ${time} - ${event.summary}`);
  }
}

async function findFreeSlots(days = 7): Promise<void> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const data = await calendarFetch(
    `/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`
  );

  console.log(`\nFree Slots (next ${days} days, 9am-5pm):\n`);

  const events = data.items || [];
  const workStart = 9;
  const workEnd = 17;

  for (let d = 0; d < days; d++) {
    const day = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // Skip weekends

    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workStart);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), workEnd);

    const dayEvents = events.filter((e: CalendarEvent) => {
      const eStart = new Date(e.start.dateTime || e.start.date!);
      return eStart >= dayStart && eStart < dayEnd;
    });

    const freeSlots: string[] = [];
    let slotStart = dayStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.start.dateTime!);
      const eventEnd = new Date(event.end.dateTime!);

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

async function searchEvents(query: string): Promise<void> {
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const data = await calendarFetch(
    `/calendars/primary/events?q=${encodeURIComponent(query)}&timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime`
  );

  console.log(`\nEvents matching "${query}":\n`);

  if (!data.items || data.items.length === 0) {
    console.log("  No matching events.");
    return;
  }

  for (const event of data.items) {
    const date = new Date(event.start.dateTime || event.start.date);
    console.log(`[${event.id.substring(0, 12)}...] ${date.toLocaleDateString()}`);
    console.log(`  ${formatEventTime(event)} - ${event.summary}`);
    console.log();
  }
}

async function createEvent(title: string, dateStr: string, timeStr: string, durationStr: string, location?: string): Promise<void> {
  const date = parseDate(dateStr);
  const time = parseTime(timeStr);
  const duration = parseDuration(durationStr);

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours, time.minutes);
  const end = new Date(start.getTime() + duration);

  const event = {
    summary: title,
    location,
    start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  };

  const result = await calendarFetch("/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(event),
  });

  console.log(`Event created: ${result.summary}`);
  console.log(`  When: ${start.toLocaleString()} - ${end.toLocaleTimeString()}`);
  console.log(`  Link: ${result.htmlLink}`);
}

async function deleteEvent(eventId: string): Promise<void> {
  await calendarFetch(`/calendars/primary/events/${eventId}`, { method: "DELETE" });
  console.log("Event deleted.");
}

async function listCalendars(): Promise<void> {
  const data = await calendarFetch("/users/me/calendarList");

  console.log("\nCalendars:\n");
  for (const cal of data.items) {
    const primary = cal.primary ? " (primary)" : "";
    console.log(`  ${cal.summary}${primary}`);
    console.log(`    ID: ${cal.id}`);
  }
}

// Main CLI
async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log(`
Google Calendar CLI - Token-efficient calendar management

Usage: bun GCalClient.ts <command> [args]

Commands:
  auth                          Re-authenticate with calendar scopes
  today                         Show today's events
  week                          Show this week's events
  free [days]                   Find free slots (default: 7 days)
  search <query>                Search events
  create <title> <date> <time> <duration> [location]
  delete <eventId>              Delete event
  calendars                     List calendars

Date formats: today, tomorrow, monday, 2024-01-15
Time formats: 2pm, 14:00, 9:30am
Duration formats: 30m, 1h, 1.5h

Examples:
  bun GCalClient.ts today
  bun GCalClient.ts create "Team Standup" tomorrow 9am 30m
  bun GCalClient.ts free 5
  bun GCalClient.ts search "standup"
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
      case "search":
        if (!args[0]) {
          console.error("Usage: search <query>");
          process.exit(1);
        }
        await searchEvents(args[0]);
        break;
      case "create":
        if (args.length < 4) {
          console.error("Usage: create <title> <date> <time> <duration> [location]");
          process.exit(1);
        }
        await createEvent(args[0], args[1], args[2], args[3], args[4]);
        break;
      case "delete":
        if (!args[0]) {
          console.error("Usage: delete <eventId>");
          process.exit(1);
        }
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
