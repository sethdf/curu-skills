# Slack Triage Workflow

Invoked by `/slack` or "check slack".

## Workflow Steps

### 1. Check Recent Activity

```bash
bun run ~/.claude/skills/Slack/Tools/SlackClient.ts auth
```

### 2. List Active Channels

Show channels with recent activity, ordered by message count.

### 3. Summarize by Priority

Group activity by:
- **Mentions**: Messages where you're @mentioned
- **DMs**: Direct messages awaiting response
- **Threads**: Threads you're participating in
- **Channels**: General channel activity

### 4. Present Summary

```
SLACK TRIAGE - [date]

MENTIONS (3)
  #engineering - @alice mentioned you in "deployment issue"
  #general - @bob asked about meeting time
  DM from @carol - "Quick question about PR"

ACTIVE THREADS (2)
  #engineering - "Architecture discussion" (5 new replies)
  #product - "Feature spec review" (2 new replies)

CHANNELS WITH ACTIVITY
  #engineering (15 new)
  #general (8 new)
  #random (3 new)

Quick Actions:
  /slack read #engineering
  /slack dm @carol "response"
```

## Example Interaction

```
User: /slack
-> Shows mentions and DMs first
-> Lists active threads
-> Suggests quick responses
```
