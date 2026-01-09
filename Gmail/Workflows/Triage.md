# Gmail Triage Workflow

Invoked by `/gmail` or "check email" requests.

## Workflow Steps

### 1. Get Unread Summary

```bash
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts unread 30
```

### 2. Categorize by Priority

Group messages by:
- **Urgent**: From known contacts, subject contains "urgent", "asap", "important"
- **Action Required**: Questions, requests, calendar invites
- **FYI**: Newsletters, notifications, automated emails
- **Low Priority**: Marketing, social media notifications

### 3. Present Summary

Format output as:

```
GMAIL TRIAGE - [date]

URGENT (2)
  [id1] From: boss@work.com - Subject: Need this ASAP
  [id2] From: client@example.com - Subject: Urgent: Contract review

ACTION REQUIRED (5)
  [id3] From: alice@team.com - Subject: Can you review this PR?
  ...

FYI (12)
  ...

Quick Actions:
  /gmail read <id>     - Read full message
  /gmail archive <id>  - Archive
  /gmail reply <id>    - Draft reply
```

### 4. Offer Actions

After presenting summary, suggest:
- Read specific high-priority messages
- Bulk archive newsletters
- Draft replies to action items

## AI-Assisted Features

When invoked through Claude Code:

1. **Smart Summarization**: Condense long messages to key points
2. **Reply Drafting**: Generate contextual reply drafts
3. **Priority Detection**: Use sender context from Contacts.md
4. **Bulk Operations**: "Archive all newsletters" type commands

## Example Interaction

```
User: /gmail