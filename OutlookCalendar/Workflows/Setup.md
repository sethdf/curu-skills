# Outlook Calendar Setup Workflow

## Prerequisites

Outlook Calendar shares OAuth with Outlook email. If you already have Outlook configured, you just need to add calendar scopes.

## If Outlook Already Configured

### Step 1: Update API Permissions

In Azure Portal, add these permissions to your app:
- `Calendars.Read`
- `Calendars.ReadWrite`
- `OnlineMeetings.ReadWrite` (optional, for Teams meetings)

### Step 2: Re-authenticate

```bash
bun run ~/.claude/skills/OutlookCalendar/Tools/OCalClient.ts auth
```

### Step 3: Verify

```bash
bun run ~/.claude/skills/OutlookCalendar/Tools/OCalClient.ts today
```

## If Starting Fresh

Follow the Outlook Setup workflow first, then:

1. Add calendar permissions in Azure Portal
2. Run the calendar auth command above

## Teams Meeting Integration

To create meetings with Teams links:

1. Ensure `OnlineMeetings.ReadWrite` permission is granted
2. Use the `teams` command:

```bash
bun run OCalClient.ts teams "Sprint Planning" monday 10am 1h
```

## Troubleshooting

### "Insufficient privileges"

Re-authenticate with calendar scopes:
```bash
rm ~/.config/outlook-cli/token.json
bun run OCalClient.ts auth
```

### Teams meeting creation fails

1. Verify `OnlineMeetings.ReadWrite` permission
2. Check your M365 license includes Teams
3. Admin may need to grant consent
