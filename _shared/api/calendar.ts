#!/usr/bin/env bun
/**
 * MS365 Calendar API Client - Microsoft Graph API for calendar operations
 *
 * This module provides deterministic functions for accessing Microsoft 365 Calendar
 * via the Graph API. Authentication is handled through auth-keeper.sh.
 *
 * Usage:
 *   import { getTodayEvents, getWeekEvents, getFreeSlots } from './_shared/api/calendar';
 *
 * Environment:
 *   MS365_USER - User email address (default from auth-keeper)
 *   TZ - Timezone (default: America/Denver)
 *
 * @author PAI System
 * @version 1.0.0
 */

import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";

// =============================================================================
// Configuration
// =============================================================================

const AUTH_KEEPER_PATH = join(
  homedir(),
  "repos/github.com/sethdf/imladris/scripts/auth-keeper.sh"
);

/**
 * Get MS365 user from environment or auth-keeper defaults
 */
function getUser(): string {
  return process.env.MS365_USER || "sfoley@buxtonco.com";
}

/**
 * Get timezone from environment
 */
function getTimezone(): string {
  return process.env.TZ || "America/Denver";
}

// =============================================================================
// Types
// =============================================================================

export interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: string;
    };
  }>;
  isAllDay: boolean;
  showAs: string; // free, tentative, busy, oof, workingElsewhere
  importance: string;
  sensitivity: string;
  webLink?: string;
  onlineMeeting?: {
    joinUrl: string;
  };
  bodyPreview?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface DaySchedule {
  date: string;
  events: CalendarEvent[];
  freeSlots: TimeSlot[];
  busyMinutes: number;
  freeMinutes: number;
}

// =============================================================================
// PowerShell Execution
// =============================================================================

/**
 * Execute a PowerShell command via auth-keeper
 */
async function runPowerShell(command: string): Promise<string> {
  const tempFile = `/tmp/calendar-${Date.now()}.ps1`;
  await Bun.write(tempFile, command);

  try {
    const result =
      await $`bash -c 'source ${AUTH_KEEPER_PATH} && _ak_ms365_cmd "$(cat ${tempFile})"'`.text();
    return result;
  } finally {
    await $`rm -f ${tempFile}`.quiet();
  }
}

// =============================================================================
// Date Helpers
// =============================================================================

/**
 * Format date for MS Graph API (ISO 8601)
 */
function formatDateForApi(date: Date): string {
  return date.toISOString();
}

/**
 * Get start of day in local timezone
 */
function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in local timezone
 */
function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add hours to a date
 */
function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Parse time string like "8:00" or "14:30" to hours
 */
function parseTimeToHours(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + (minutes || 0) / 60;
}

// =============================================================================
// Calendar API Functions
// =============================================================================

/**
 * Get events for a date range
 */
export async function getEvents(
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const user = getUser();
  const tz = getTimezone();
  const startStr = formatDateForApi(startDate);
  const endStr = formatDateForApi(endDate);

  const psCommand = `
\$user = '${user}'
\$startTime = '${startStr}'
\$endTime = '${endStr}'

Get-MgUserCalendarView -UserId \$user -StartDateTime \$startTime -EndDateTime \$endTime -Top 100 |
  Select-Object Id, Subject, Start, End, Location, Organizer, Attendees, IsAllDay, ShowAs, Importance, Sensitivity, WebLink, OnlineMeeting, BodyPreview |
  ConvertTo-Json -Depth 5
`.trim();

  const result = await runPowerShell(psCommand);

  try {
    const parsed = JSON.parse(result);
    const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    // Normalize the response structure
    return events.map((e: any) => ({
      id: e.Id,
      subject: e.Subject || "(No subject)",
      start: {
        dateTime: e.Start?.DateTime || e.Start,
        timeZone: e.Start?.TimeZone || tz,
      },
      end: {
        dateTime: e.End?.DateTime || e.End,
        timeZone: e.End?.TimeZone || tz,
      },
      location: e.Location ? { displayName: e.Location.DisplayName || e.Location } : undefined,
      organizer: e.Organizer?.EmailAddress ? {
        emailAddress: {
          name: e.Organizer.EmailAddress.Name,
          address: e.Organizer.EmailAddress.Address,
        }
      } : undefined,
      attendees: e.Attendees?.map((a: any) => ({
        emailAddress: {
          name: a.EmailAddress?.Name,
          address: a.EmailAddress?.Address,
        },
        status: { response: a.Status?.Response },
      })),
      isAllDay: e.IsAllDay || false,
      showAs: e.ShowAs || "busy",
      importance: e.Importance || "normal",
      sensitivity: e.Sensitivity || "normal",
      webLink: e.WebLink,
      onlineMeeting: e.OnlineMeeting ? { joinUrl: e.OnlineMeeting.JoinUrl } : undefined,
      bodyPreview: e.BodyPreview,
    }));
  } catch (e) {
    console.error(`Failed to parse calendar response: ${e}`);
    return [];
  }
}

/**
 * Get today's events
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
  const start = getStartOfDay();
  const end = getEndOfDay();
  return getEvents(start, end);
}

/**
 * Get events for the next N hours
 */
export async function getNextHoursEvents(hours: number): Promise<CalendarEvent[]> {
  const start = new Date();
  const end = addHours(start, hours);
  return getEvents(start, end);
}

/**
 * Get this week's events (Monday to Sunday)
 */
export async function getWeekEvents(): Promise<CalendarEvent[]> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = addDays(today, -((dayOfWeek + 6) % 7)); // Adjust to Monday
  const start = getStartOfDay(monday);
  const end = getEndOfDay(addDays(monday, 6)); // Sunday
  return getEvents(start, end);
}

/**
 * Get events for the next N days
 */
export async function getNextDaysEvents(days: number): Promise<CalendarEvent[]> {
  const start = getStartOfDay();
  const end = getEndOfDay(addDays(start, days - 1));
  return getEvents(start, end);
}

/**
 * Calculate free time slots for a day
 * workdayStart/End in 24h format like "8:00" and "17:00"
 */
export function calculateFreeSlots(
  events: CalendarEvent[],
  date: Date,
  workdayStart: string = "8:00",
  workdayEnd: string = "17:00",
  minSlotMinutes: number = 30
): TimeSlot[] {
  const dayStart = getStartOfDay(date);
  const workStart = new Date(dayStart);
  const workEnd = new Date(dayStart);

  const [startHour, startMin] = workdayStart.split(":").map(Number);
  const [endHour, endMin] = workdayEnd.split(":").map(Number);

  workStart.setHours(startHour, startMin || 0, 0, 0);
  workEnd.setHours(endHour, endMin || 0, 0, 0);

  // Filter to non-all-day events that show as busy
  const busyEvents = events
    .filter(e => !e.isAllDay && e.showAs !== "free")
    .map(e => ({
      start: new Date(e.start.dateTime),
      end: new Date(e.end.dateTime),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const freeSlots: TimeSlot[] = [];
  let cursor = workStart;

  for (const event of busyEvents) {
    // If there's a gap before this event
    if (event.start > cursor) {
      const slotEnd = event.start < workEnd ? event.start : workEnd;
      const durationMinutes = Math.round((slotEnd.getTime() - cursor.getTime()) / 60000);

      if (durationMinutes >= minSlotMinutes) {
        freeSlots.push({
          start: new Date(cursor),
          end: new Date(slotEnd),
          durationMinutes,
        });
      }
    }

    // Move cursor past this event
    if (event.end > cursor) {
      cursor = new Date(event.end);
    }
  }

  // Check for free time after last event
  if (cursor < workEnd) {
    const durationMinutes = Math.round((workEnd.getTime() - cursor.getTime()) / 60000);
    if (durationMinutes >= minSlotMinutes) {
      freeSlots.push({
        start: new Date(cursor),
        end: new Date(workEnd),
        durationMinutes,
      });
    }
  }

  return freeSlots;
}

/**
 * Get day schedule with events and free slots
 */
export async function getDaySchedule(
  date: Date = new Date(),
  workdayStart: string = "8:00",
  workdayEnd: string = "17:00"
): Promise<DaySchedule> {
  const start = getStartOfDay(date);
  const end = getEndOfDay(date);
  const events = await getEvents(start, end);
  const freeSlots = calculateFreeSlots(events, date, workdayStart, workdayEnd);

  // Calculate busy/free time
  const busyMinutes = events
    .filter(e => !e.isAllDay && e.showAs !== "free")
    .reduce((acc, e) => {
      const eventStart = new Date(e.start.dateTime);
      const eventEnd = new Date(e.end.dateTime);
      return acc + Math.round((eventEnd.getTime() - eventStart.getTime()) / 60000);
    }, 0);

  const freeMinutes = freeSlots.reduce((acc, s) => acc + s.durationMinutes, 0);

  return {
    date: date.toISOString().split("T")[0],
    events,
    freeSlots,
    busyMinutes,
    freeMinutes,
  };
}

/**
 * Create a calendar event
 */
export async function createEvent(options: {
  subject: string;
  start: Date;
  end: Date;
  location?: string;
  body?: string;
  attendees?: string[];
  isOnlineMeeting?: boolean;
}): Promise<CalendarEvent | null> {
  const user = getUser();
  const tz = getTimezone();

  const attendeesJson = options.attendees
    ? JSON.stringify(options.attendees.map(email => ({
        EmailAddress: { Address: email },
        Type: "required"
      })))
    : "[]";

  const psCommand = `
\$user = '${user}'
\$params = @{
  Subject = '${options.subject.replace(/'/g, "''")}'
  Start = @{
    DateTime = '${options.start.toISOString()}'
    TimeZone = '${tz}'
  }
  End = @{
    DateTime = '${options.end.toISOString()}'
    TimeZone = '${tz}'
  }
  ${options.location ? `Location = @{ DisplayName = '${options.location.replace(/'/g, "''")}' }` : ""}
  ${options.body ? `Body = @{ ContentType = 'text'; Content = '${options.body.replace(/'/g, "''")}' }` : ""}
  ${options.attendees?.length ? `Attendees = ${attendeesJson}` : ""}
  ${options.isOnlineMeeting ? "IsOnlineMeeting = \\$true" : ""}
}

New-MgUserEvent -UserId \$user -BodyParameter \$params | ConvertTo-Json -Depth 5
`.trim();

  try {
    const result = await runPowerShell(psCommand);
    const parsed = JSON.parse(result);
    return {
      id: parsed.Id,
      subject: parsed.Subject,
      start: { dateTime: parsed.Start?.DateTime, timeZone: tz },
      end: { dateTime: parsed.End?.DateTime, timeZone: tz },
      isAllDay: false,
      showAs: "busy",
      importance: "normal",
      sensitivity: "normal",
    };
  } catch (e) {
    console.error(`Failed to create event: ${e}`);
    return null;
  }
}

/**
 * Check if MS365 calendar connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  const user = getUser();

  const psCommand = `
Get-MgUserCalendar -UserId '${user}' -Top 1 | Select-Object Name | ConvertTo-Json
`.trim();

  try {
    const result = await runPowerShell(psCommand);
    const parsed = JSON.parse(result);
    return !!parsed?.Name || Array.isArray(parsed);
  } catch (e) {
    return false;
  }
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format time for display (e.g., "9:00 AM")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format duration for display (e.g., "1h 30m")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format event for display
 */
export function formatEvent(event: CalendarEvent): string {
  const startTime = formatTime(event.start.dateTime);
  const endTime = formatTime(event.end.dateTime);
  const location = event.location?.displayName ? ` @ ${event.location.displayName}` : "";
  const online = event.onlineMeeting?.joinUrl ? " [Teams]" : "";
  return `${startTime} - ${endTime}: ${event.subject}${location}${online}`;
}

/**
 * Format free slot for display
 */
export function formatFreeSlot(slot: TimeSlot): string {
  const startTime = formatTime(slot.start);
  const endTime = formatTime(slot.end);
  const duration = formatDuration(slot.durationMinutes);
  return `${startTime} - ${endTime} (${duration} free)`;
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "health":
      const healthy = await healthCheck();
      console.log(healthy ? "Calendar connection OK" : "Calendar connection FAILED");
      process.exit(healthy ? 0 : 1);
      break;

    case "today":
      const todayEvents = await getTodayEvents();
      if (todayEvents.length === 0) {
        console.log("No events today");
      } else {
        console.log(`Today's Schedule (${todayEvents.length} events):\n`);
        todayEvents
          .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
          .forEach(e => console.log(`  ${formatEvent(e)}`));
      }
      break;

    case "next":
      const hours = parseInt(args[1]) || 2;
      const nextEvents = await getNextHoursEvents(hours);
      if (nextEvents.length === 0) {
        console.log(`No events in the next ${hours} hours`);
      } else {
        console.log(`Next ${hours} hours (${nextEvents.length} events):\n`);
        nextEvents
          .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
          .forEach(e => console.log(`  ${formatEvent(e)}`));
      }
      break;

    case "week":
      const weekEvents = await getWeekEvents();
      if (weekEvents.length === 0) {
        console.log("No events this week");
      } else {
        // Group by day
        const byDay = new Map<string, CalendarEvent[]>();
        weekEvents.forEach(e => {
          const day = new Date(e.start.dateTime).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(e);
        });

        console.log(`This Week (${weekEvents.length} events):\n`);
        byDay.forEach((events, day) => {
          console.log(`${day}:`);
          events
            .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
            .forEach(e => console.log(`  ${formatEvent(e)}`));
          console.log();
        });
      }
      break;

    case "free":
    case "free-slots":
      const schedule = await getDaySchedule();
      console.log(`Free slots today (workday 8:00 AM - 5:00 PM):\n`);
      if (schedule.freeSlots.length === 0) {
        console.log("  No free slots available");
      } else {
        schedule.freeSlots.forEach(s => console.log(`  ${formatFreeSlot(s)}`));
      }
      console.log(`\nSummary: ${formatDuration(schedule.busyMinutes)} in meetings, ${formatDuration(schedule.freeMinutes)} free`);
      break;

    case "schedule":
      const daySchedule = await getDaySchedule();
      console.log(`Today's Schedule:\n`);
      console.log("Events:");
      if (daySchedule.events.length === 0) {
        console.log("  No events");
      } else {
        daySchedule.events
          .sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
          .forEach(e => console.log(`  ${formatEvent(e)}`));
      }
      console.log("\nFree Slots:");
      if (daySchedule.freeSlots.length === 0) {
        console.log("  No free slots");
      } else {
        daySchedule.freeSlots.forEach(s => console.log(`  ${formatFreeSlot(s)}`));
      }
      console.log(`\nSummary: ${formatDuration(daySchedule.busyMinutes)} busy, ${formatDuration(daySchedule.freeMinutes)} free`);
      break;

    case "json":
      const subCmd = args[1] || "today";
      let data: any;
      switch (subCmd) {
        case "today":
          data = await getTodayEvents();
          break;
        case "week":
          data = await getWeekEvents();
          break;
        case "schedule":
          data = await getDaySchedule();
          break;
        default:
          data = await getTodayEvents();
      }
      console.log(JSON.stringify(data, null, 2));
      break;

    default:
      console.log(`
Calendar CLI - MS365 Calendar Operations

Usage:
  bun calendar.ts health          Check calendar connection
  bun calendar.ts today           Show today's events
  bun calendar.ts next [hours]    Show events in next N hours (default: 2)
  bun calendar.ts week            Show this week's events
  bun calendar.ts free            Show today's free time slots
  bun calendar.ts schedule        Show today's events + free slots
  bun calendar.ts json [cmd]      Output as JSON (today|week|schedule)
`);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
