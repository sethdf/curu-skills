# Google Calendar Setup Workflow

## Prerequisites

Google Calendar shares OAuth with Gmail. If you already have Gmail configured, you just need to add calendar scopes.

## If Gmail Already Configured

### Step 1: Update OAuth Scopes

Re-authenticate to add calendar scopes:

```bash
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts auth
```

This will request both Gmail and Calendar scopes.

### Step 2: Verify

```bash
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts today
```

## If Starting Fresh

Follow the Gmail Setup workflow first, then run the calendar auth command above.

### Required Scopes

The auth command requests these calendar scopes:
- `calendar.readonly` - Read calendar events
- `calendar.events` - Create, modify, delete events

## Troubleshooting

### "Request had insufficient authentication scopes"

You have a Gmail token but without calendar permissions:

```bash
# Re-authenticate with all scopes
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts auth
```

### Calendar not showing events

```bash
# List all calendars to verify access
bun run GCalClient.ts calendars
```

Ensure you're checking the correct calendar (primary vs shared).
