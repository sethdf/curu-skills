---
name: OutlookCalendar
description: Microsoft 365 Calendar integration via Graph API. USE WHEN checking outlook calendar, creating meetings, finding availability, teams meetings. Invoke with /ocal.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# OutlookCalendar

CLI-first Microsoft 365 Calendar integration using Microsoft Graph API. Token-efficient - loads only when invoked.

## Quick Start

```bash
/ocal                        # Today's schedule
/ocal today                  # Today's events
/ocal week                   # This week's events
/ocal free                   # Find free slots
/ocal create "Meeting" tomorrow 2pm 1h
/ocal teams "Sync" tomorrow 3pm 30m  # Create Teams meeting
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup ocal", "configure outlook calendar" | `Workflows/Setup.md` |
| **DailyBrief** | "/ocal", "outlook schedule" | `Workflows/DailyBrief.md` |

## Authentication

Uses same OAuth as Outlook email. Tokens in `~/.config/outlook-cli/` (shared):

```bash
~/.config/outlook-cli/
├── credentials.json      # Azure app registration
└── token.json           # Access/refresh tokens
```

### Additional API Permissions

Add to existing Outlook app registration:
- `Calendars.Read` - Read calendars
- `Calendars.ReadWrite` - Create/modify events
- `OnlineMeetings.ReadWrite` - Create Teams meetings (optional)

## Tool Usage

The `Tools/OCalClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/OutlookCalendar/Tools/OCalClient.ts <command> [args]

# Commands:
#   auth                  - Re-authenticate with calendar scopes
#   today                 - Show today's events
#   week                  - Show this week's events
#   range <start> <end>   - Events in date range (YYYY-MM-DD)
#   search <query>        - Search events by subject
#   free [days]           - Find free slots using scheduling API
#   availability <email> [days]  - Check someone's availability
#   create <title> <start> <duration> [attendees]
#   teams <title> <start> <duration> [attendees]  # With Teams link
#   update <id> <field> <value>
#   delete <id>           - Delete/cancel event
#   accept <id>           - Accept meeting invite
#   decline <id>          - Decline meeting invite
#   tentative <id>        - Tentatively accept
#   calendars             - List available calendars
```

## Teams Integration

Create meetings with automatic Teams links:

```bash
# Simple Teams meeting
/ocal teams "Weekly Sync" monday 10am 1h

# With attendees
/ocal teams "Project Review" tomorrow 2pm 30m "alice@company.com,bob@company.com"
```

## Availability Features

Microsoft Graph provides rich availability APIs:

```bash
# Your free slots
/ocal free 5

# Check colleague's availability
/ocal availability alice@company.com 3

# Find mutual free time (coming soon)
/ocal findtime "alice@company.com,bob@company.com" 60m
```

## Examples

**Example 1: Morning brief**
```
User: "/ocal"
-> Shows today's schedule
-> Highlights Teams meetings with join links
-> Shows meeting prep time
```

**Example 2: Schedule Teams meeting**
```
User: "/ocal teams 'Sprint Planning' monday 10am 2h"
-> Creates calendar event
-> Generates Teams meeting link
-> Returns event ID and join URL
```

**Example 3: Check availability before scheduling**
```
User: "When is alice@company.com free this week?"
-> Queries scheduling API
-> Returns available slots
-> Suggests optimal meeting times
```

**Example 4: Respond to invites**
```
User: "/ocal tentative abc123"
-> Marks meeting as tentative
-> Optionally adds response message
```

## Configuration

Optional config in `~/.config/ocal-cli/config.json`:

```json
{
  "workingHours": { "start": "08:00", "end": "18:00" },
  "defaultDuration": "30m",
  "timezone": "America/Denver",
  "defaultTeamsMeeting": true
}
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Token expired | Run `auth` command |
| `403 Forbidden` | Missing calendar permission | Check Azure app permissions |
| `404 Not Found` | Event deleted/cancelled | Event no longer exists |
| `ErrorItemNotFound` | Calendar not accessible | Check calendar permissions |
