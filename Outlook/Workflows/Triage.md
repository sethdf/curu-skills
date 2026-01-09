# Outlook Triage Workflow

Invoked by `/outlook` or "check outlook email".

## Workflow Steps

### 1. Get Unread Summary

```bash
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts unread 30
```

### 2. Categorize by Priority

Group messages by:
- **Focused**: Important messages (if Focused Inbox enabled)
- **Urgent**: Manager emails, flagged items, "urgent" in subject
- **Action Required**: Questions, requests, meeting invites
- **FYI**: Newsletters, automated notifications
- **Other**: Remaining messages

### 3. Present Summary

Format output as:

```
OUTLOOK TRIAGE - [date]

URGENT (2)
  [id1] From: manager@company.com - Subject: Need approval ASAP
  [id2] From: client@external.com - Subject: Contract deadline

ACTION REQUIRED (5)
  [id3] From: alice@company.com - Subject: Review needed
  ...

Quick Actions:
  /outlook read <id>     - Read full message
  /outlook archive <id>  - Move to archive
  /outlook reply <id>    - Draft reply
```

### 4. Integration with Calendar

Cross-reference with Outlook Calendar:
- Highlight emails from today's meeting attendees
- Flag emails about upcoming meetings

## Example Interaction

```
User: /outlook
-> Lists unread by category
-> Shows focused inbox items first
-> Suggests quick actions
```
