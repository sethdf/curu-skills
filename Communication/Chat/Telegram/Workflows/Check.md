# Check Workflow

Invoked by `/telegram` or "check telegram".

## Workflow Steps

### 1. Get Recent Updates

```bash
bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts updates 30
```

### 2. Group by Chat

Organize messages by conversation:
- Personal chats
- Group chats
- Channel updates

### 3. Present Summary

```
TELEGRAM CHECK - [date]

PERSONAL MESSAGES (3)
  From: Mom (2 hours ago)
    "Call me when you get a chance"
    Chat ID: 123456789

  From: Alice (5 hours ago)
    "Thanks for the help yesterday!"
    Chat ID: 987654321

GROUP MESSAGES (5)
  Family Group (3 new)
    Last: "Dinner plans for Sunday?"
    Chat ID: -100123456789

  Friends (2 new)
    Last: "Movie night this weekend?"
    Chat ID: -100987654321

Quick Actions:
  /telegram send 123456789 "response"
  /telegram send family "I'll be there!"
```

### 4. Suggest Responses

Based on message content, suggest quick replies for:
- Questions awaiting answers
- Time-sensitive messages
- Unacknowledged messages

## Example Interaction

```
User: /telegram
-> Shows recent messages grouped by chat
-> Highlights messages needing response
-> Provides quick action commands
```
