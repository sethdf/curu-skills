---
name: Calendar
description: Zone-aware calendar management via auth-keeper. USE WHEN checking calendar OR scheduling meetings OR finding free time OR viewing schedule. Routes to MS365 (work) or Google Calendar (home) based on ZONE.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Calendar/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Calendar

Zone-aware calendar skill using auth-keeper backend. Automatically routes to MS365 Outlook Calendar (work zone) or Google Calendar (home zone).

## Zone Routing

| Zone | Backend | Command |
|---------|---------|---------|
| `work` | MS365 Graph API (PowerShell) | `auth-keeper ms365 "Get-MgUserEvent..."` |
| `home` | Google Calendar API (curl) | `auth-keeper google calendar` |

**Detection:** Uses `$ZONE` environment variable set by direnv.

## Quick Reference

```bash
# Check zone
echo $ZONE

# Work context (MS365)
auth-keeper ms365 "Get-MgUserEvent -UserId 'sfoley@buxtonco.com' -Top 10"

# Home context (Google)
auth-keeper google calendar
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Today** | "today's schedule", "what's on my calendar" | `Workflows/Today.md` |
| **Week** | "this week", "week ahead" | `Workflows/Week.md` |
| **Create** | "schedule meeting", "create event" | `Workflows/Create.md` |

## Examples

**Example 1: Check today's schedule**
```
User: "What's on my calendar today?"
→ Detects ZONE (work or home)
→ If work: Get-MgUserEvent with today's date filter
→ If home: auth-keeper google calendar
→ Shows today's events with times
```

**Example 2: View the week**
```
User: "Show me this week's calendar"
→ Detects ZONE
→ Queries events for next 7 days
→ Groups by day and shows schedule
```

**Example 3: Find free time**
```
User: "When am I free tomorrow?"
→ Gets tomorrow's events
→ Identifies gaps between meetings
→ Returns available time slots
```

## MS365 PowerShell Commands

Common commands for work zone:

```powershell
# Today's events
$today = (Get-Date).ToString("yyyy-MM-dd")
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Get-MgUserEvent -UserId 'sfoley@buxtonco.com' -Filter "start/dateTime ge '$today' and start/dateTime lt '$tomorrow'" |
  Select-Object @{N='Time';E={$_.Start.DateTime.Substring(11,5)}}, Subject |
  Sort-Object Time

# This week's events
$weekEnd = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
Get-MgUserEvent -UserId 'sfoley@buxtonco.com' -Filter "start/dateTime ge '$today' and start/dateTime lt '$weekEnd'" -Top 50

# Create event (basic)
New-MgUserEvent -UserId 'sfoley@buxtonco.com' -Subject "Meeting" -Start @{DateTime="2024-01-15T14:00:00"; TimeZone="America/Denver"} -End @{DateTime="2024-01-15T15:00:00"; TimeZone="America/Denver"}
```

## Google Calendar Commands

Commands for home zone:

```bash
# Today's events
auth-keeper google calendar

# Get access token for custom queries
TOKEN=$(auth-keeper google --token)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TOMORROW=$(date -u -d "+1 day" +%Y-%m-%dT%H:%M:%SZ)
curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=$NOW&timeMax=$TOMORROW&singleEvents=true&orderBy=startTime" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `ZONE not set` | Not in work/home directory | `cd` to zone directory or `export ZONE=work` |
| `BWS not available` | Bitwarden Secrets not initialized | Run `bws login` |
| `Token expired` | Google OAuth expired | Run `auth-keeper google --auth` |
| `CalendarId required` | Wrong PowerShell cmdlet | Use `Get-MgUserEvent` not `Get-MgUserCalendarEvent` |
