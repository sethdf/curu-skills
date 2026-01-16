# Check Workflow

Aggregate unread/pending messages from all communication platforms.

## Steps

1. **Check platforms in priority order:**

   ```
   For each platform (Mail -> Calendar -> Slack -> Telegram -> Signal):
     - Invoke the platform skill
     - Capture unread counts and urgent items
     - Note any errors (platform unavailable, auth expired)
   ```

2. **Aggregate results:**

   ```
   Build unified summary:
   - Total unread across all platforms
   - Breakdown by platform
   - Urgent items highlighted
   - Upcoming calendar events
   ```

3. **Present summary:**

   ```markdown
   ## Communications Summary

   ### Email
   **Work (MS365):** X unread (Y urgent)
   **Home (Gmail):** X unread

   ### Calendar
   **Today:** X events
   - Next: [Event name] at [time]

   ### Messaging
   **Slack:** X mentions in Y channels
   **Telegram:** X messages
   **Signal:** X messages

   ### Urgent Items
   - [Platform] From: sender - Subject/preview

   ### Recommended Actions
   - Start with urgent work email
   - Then process Slack mentions
   ```

## Platform Invocation

Invoke each skill in order. Use the Skill tool or direct commands:

### 1. Email (Mail skill)
```
Invoke Mail skill for email triage:
- Work context: MS365 unread count and urgent items
- Home context: Gmail unread count
```

### 2. Calendar (Calendar skill)
```
Invoke Calendar skill for today's schedule:
- Work context: MS365 calendar
- Home context: Google calendar
- Show next upcoming event
```

### 3. Slack (Slack skill)
```
Invoke Slack skill:
- Unread mentions
- DMs
- Priority channels
```

### 4. Telegram (Telegram skill)
```
Invoke Telegram skill:
- Unread messages
- Group mentions
```

### 5. Signal
```
Check Signal via signal-interface:
~/bin/signal-interface status
```

## Error Handling

If a platform fails:
- Note the error in summary (e.g., "Slack: auth expired")
- Continue with other platforms
- Suggest remediation at end
