#!/usr/bin/env bun
/**
 * Startup CLI - Morning ritual orchestrator
 *
 * Gathers context from calendar, SDP, and inbox to help you
 * pick ONE thing to focus on before opening Slack/email.
 *
 * Usage:
 *   bun startup.ts              # Full context gathering
 *   bun startup.ts quick        # Just calendar + time check
 *   bun startup.ts calendar     # Calendar only
 *   bun startup.ts dump "idea"  # Quick brain dump
 *
 * @author PAI System
 * @version 1.0.0
 */

import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, appendFileSync } from "fs";

// =============================================================================
// Configuration
// =============================================================================

const CALENDAR_CLI = join(
  homedir(),
  "repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts"
);

const IDEAS_FILE = join(
  homedir(),
  ".claude/skills/CORE/USER/TELOS/IDEAS.md"
);

const SCRATCH_DIR = join(homedir(), "work/scratch");

// =============================================================================
// Helpers
// =============================================================================

function getTodayScratchFile(): string {
  const date = new Date().toISOString().split("T")[0];
  return join(SCRATCH_DIR, `${date}.md`);
}

function ensureScratchDir(): void {
  if (!existsSync(SCRATCH_DIR)) {
    mkdirSync(SCRATCH_DIR, { recursive: true });
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// =============================================================================
// Brain Dump
// =============================================================================

async function brainDump(text: string, type: "idea" | "task" = "task"): Promise<void> {
  const timestamp = new Date().toISOString();

  if (type === "idea") {
    // Append to IDEAS.md
    const entry = `\n## ${timestamp.split("T")[0]} ${timestamp.split("T")[1].substring(0, 5)}\n${text}\n`;
    appendFileSync(IDEAS_FILE, entry);
    console.log(`Idea captured to IDEAS.md`);
  } else {
    // Append to today's scratch file
    ensureScratchDir();
    const scratchFile = getTodayScratchFile();
    const time = formatTime(new Date());
    const entry = `- [${time}] ${text}\n`;
    appendFileSync(scratchFile, entry);
    console.log(`Task captured to ${scratchFile}`);
  }
}

// =============================================================================
// Calendar Integration
// =============================================================================

interface CalendarEvent {
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: { displayName: string };
  onlineMeeting?: { joinUrl: string };
}

interface DaySchedule {
  date: string;
  events: CalendarEvent[];
  freeSlots: Array<{
    start: Date;
    end: Date;
    durationMinutes: number;
  }>;
  busyMinutes: number;
  freeMinutes: number;
}

async function getCalendarSchedule(): Promise<DaySchedule | null> {
  try {
    const result = await $`bun ${CALENDAR_CLI} json schedule`.text();
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to get calendar:", e);
    return null;
  }
}

async function getNextEvents(hours: number): Promise<CalendarEvent[]> {
  try {
    const result = await $`bun ${CALENDAR_CLI} json today`.text();
    const events: CalendarEvent[] = JSON.parse(result);

    const now = new Date();
    const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return events.filter((e) => {
      const start = new Date(e.start.dateTime);
      return start >= now && start <= cutoff;
    });
  } catch (e) {
    return [];
  }
}

// =============================================================================
// Display Functions
// =============================================================================

function displayHeader(): void {
  const now = new Date();
  const timeStr = formatTime(now);
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  console.log("\n" + "=".repeat(60));
  console.log("  STARTUP RITUAL");
  console.log(`  ${dateStr} | ${timeStr}`);
  console.log("=".repeat(60) + "\n");
}

function displayCalendar(schedule: DaySchedule): void {
  console.log("TODAY'S CALENDAR\n");

  if (schedule.events.length === 0) {
    console.log("  No meetings today - full day for focus work!\n");
  } else {
    // Sort events by start time
    const sorted = [...schedule.events].sort(
      (a, b) =>
        new Date(a.start.dateTime).getTime() -
        new Date(b.start.dateTime).getTime()
    );

    sorted.forEach((e) => {
      const start = formatTime(new Date(e.start.dateTime));
      const end = formatTime(new Date(e.end.dateTime));
      const location = e.location?.displayName ? ` @ ${e.location.displayName}` : "";
      const online = e.onlineMeeting?.joinUrl ? " [Online]" : "";
      console.log(`  ${start} - ${end}: ${e.subject}${location}${online}`);
    });
    console.log();
  }

  // Free slots
  console.log("FREE SLOTS (30+ min)\n");
  if (schedule.freeSlots.length === 0) {
    console.log("  No significant free slots today\n");
  } else {
    schedule.freeSlots.forEach((slot) => {
      const start = formatTime(new Date(slot.start));
      const end = formatTime(new Date(slot.end));
      console.log(`  ${start} - ${end} (${formatDuration(slot.durationMinutes)})`);
    });
    console.log();
  }

  // Summary
  console.log(
    `Summary: ${formatDuration(schedule.busyMinutes)} in meetings, ${formatDuration(schedule.freeMinutes)} available\n`
  );
}

function displayNextMeeting(events: CalendarEvent[]): void {
  if (events.length === 0) {
    console.log("NEXT 2 HOURS: Clear - no meetings\n");
    return;
  }

  const next = events[0];
  const start = new Date(next.start.dateTime);
  const now = new Date();
  const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);

  console.log("NEXT MEETING\n");
  console.log(`  ${next.subject}`);
  console.log(`  ${formatTime(start)} (in ${formatDuration(minutesUntil)})`);
  if (next.location?.displayName) {
    console.log(`  Location: ${next.location.displayName}`);
  }
  if (next.onlineMeeting?.joinUrl) {
    console.log(`  Join: ${next.onlineMeeting.joinUrl}`);
  }
  console.log();
}

function displayFocusPrompt(freeMinutes: number): void {
  console.log("-".repeat(60));
  console.log("\nTIME TO CHOOSE YOUR ONE THING\n");

  if (freeMinutes >= 120) {
    console.log("You have 2+ hours available - good for deep work.");
  } else if (freeMinutes >= 60) {
    console.log("You have about an hour - pick something meaningful.");
  } else if (freeMinutes >= 30) {
    console.log("Limited time - consider a quick win.");
  } else {
    console.log("Tight schedule - survival mode or quick tasks only.");
  }

  console.log("\nQuestions to ask yourself:");
  console.log("  1. Is anything on fire? (production, deadline, blocking others)");
  console.log("  2. What's overdue?");
  console.log("  3. What have I been avoiding?");
  console.log("  4. What fits this time window?");
  console.log();
}

// =============================================================================
// Main Commands
// =============================================================================

async function fullStartup(): Promise<void> {
  displayHeader();

  // Get calendar
  console.log("Fetching calendar...\n");
  const schedule = await getCalendarSchedule();

  if (schedule) {
    displayCalendar(schedule);

    // Show next meeting specifically
    const nextEvents = await getNextEvents(2);
    displayNextMeeting(nextEvents);

    // Focus prompt
    displayFocusPrompt(schedule.freeMinutes);
  } else {
    console.log("Could not fetch calendar. Proceeding without it.\n");
    displayFocusPrompt(480); // Assume full day
  }

  console.log("What is your ONE thing for this focus block?");
  console.log("(Slack and email stay closed until you complete it)\n");
}

async function quickStartup(): Promise<void> {
  console.log("\nQUICK RESET\n");

  const nextEvents = await getNextEvents(2);

  if (nextEvents.length === 0) {
    console.log("Next 2 hours: Clear\n");
  } else {
    const next = nextEvents[0];
    const start = new Date(next.start.dateTime);
    const now = new Date();
    const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);
    console.log(`Next: ${next.subject} in ${formatDuration(minutesUntil)}\n`);
  }

  console.log("Your ONE thing for this block?\n");
}

async function calendarOnly(): Promise<void> {
  console.log("\nTODAY'S SCHEDULE\n");
  const schedule = await getCalendarSchedule();
  if (schedule) {
    displayCalendar(schedule);
  } else {
    console.log("Could not fetch calendar.\n");
  }
}

// =============================================================================
// CLI
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "quick":
      await quickStartup();
      break;

    case "calendar":
      await calendarOnly();
      break;

    case "dump":
      const text = args.slice(1).join(" ");
      if (!text) {
        console.log("Usage: startup.ts dump <text>");
        console.log("       startup.ts dump --idea <text>");
        process.exit(1);
      }
      const isIdea = args[1] === "--idea";
      const dumpText = isIdea ? args.slice(2).join(" ") : text;
      await brainDump(dumpText, isIdea ? "idea" : "task");
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(`
Startup CLI - Morning ritual orchestrator

Usage:
  bun startup.ts              Full startup ritual (calendar + focus prompt)
  bun startup.ts quick        Quick reset (next meeting + focus prompt)
  bun startup.ts calendar     Calendar only
  bun startup.ts dump <text>  Quick brain dump to scratch file
  bun startup.ts dump --idea <text>  Capture idea to IDEAS.md

The ritual:
  1. Shows today's calendar and free slots
  2. Highlights next meeting
  3. Prompts you to pick ONE thing to focus on
  4. Keeps Slack/email closed until focus block complete
`);
      break;

    default:
      await fullStartup();
  }
}

// Run CLI
if (import.meta.main) {
  main().catch(console.error);
}
