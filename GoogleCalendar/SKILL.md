---
name: GoogleCalendar
description: Google Calendar API integration for schedule management. USE WHEN checking calendar, creating events, finding free time, managing google calendar. Invoke with /gcal.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# GoogleCalendar

CLI-first Google Calendar integration using Calendar API. Token-efficient - loads only when invoked.

## Quick Start

```bash
/gcal                        # Today's schedule
/gcal today                  # Today's events
/gcal week                   # This week's events
/gcal free                   # Find free slots
/gcal create "Meeting" tomorrow 2pm 1h
/gcal search "standup"       # Find events by text
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup gcal", "configure google calendar" | `Workflows/Setup.md` |
| **DailyBrief** | "/gcal", "what's on my calendar" | `Workflows/DailyBrief.md` |

## Authentication

Uses same OAuth as Gmail. Tokens in `~/.config/gmail-cli/` (shared):

```bash
~/.config/gmail-cli/
├── credentials.json      # OAuth client (from Google Cloud Console)
└── token.json           # Access/refresh tokens
```

### Additional Scopes Required

Add to existing Gmail OAuth:
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendars
- `https://www.googleapis.com/auth/calendar.events` - Manage events

## Tool Usage

The `Tools/GCalClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts <command> [args]

# Commands:
#   auth                  - Re-authenticate with calendar scopes
#   today                 - Show today's events
#   week                  - Show this week's events
#   range <start> <end>   - Events in date range (YYYY-MM-DD)
#   search <query>        - Search events by text
#   free [days]           - Find free slots (default: 7 days)
#   create <title> <start> <duration> [location]
#   update <id> <field> <value>
#   delete <id>           - Delete event
#   calendars             - List available calendars
```

## Date/Time Formats

Flexible input parsing:
- `today`, `tomorrow`, `monday`, `next week`
- `2pm`, `14:00`, `2:30pm`
- `2024-01-15`, `Jan 15`, `1/15`
- Durations: `30m`, `1h`, `1.5h`, `2h30m`

## Examples

**Example 1: Morning brief**
```
User: "/gcal"
-> Shows today's schedule
-> Highlights conflicts
-> Shows prep time between meetings
```

**Example 2: Schedule meeting**
```
User: "/gcal create 'Team Standup' tomorrow 9am 30m"
-> Creates event on primary calendar
-> Returns event ID and link
```

**Example 3: Find availability**
```
User: "/gcal free 5"
-> Scans next 5 days
-> Returns available 30min+ slots
-> Excludes outside working hours (configurable)
```

**Example 4: Cross-reference with email**
```
User: "Do I have any meetings with alice@example.com this week?"
-> Searches calendar for attendee
-> Shows matching events
```

## Configuration

Optional config in `~/.config/gcal-cli/config.json`:

```json
{
  "workingHours": { "start": "09:00", "end": "17:00" },
  "defaultDuration": "30m",
  "defaultCalendar": "primary",
  "timezone": "America/Denver"
}
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Token expired | Run `auth` command |
| `403 insufficientPermissions` | Missing calendar scope | Re-auth with calendar scopes |
| `404 Not Found` | Event deleted | Event no longer exists |
| `409 Conflict` | Double-booking | Check for conflicts first |
