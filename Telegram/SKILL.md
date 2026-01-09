---
name: Telegram
description: Telegram Bot API integration for personal messaging. USE WHEN sending telegram messages, checking telegram, managing personal chats. Invoke with /telegram.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Telegram

CLI-first Telegram integration using the Bot API. Token-efficient - loads only when invoked.

## Quick Start

```bash
/telegram                    # Show recent messages
/telegram chats              # List recent chats
/telegram read [chat_id]     # Read messages from chat
/telegram send <chat> "msg"  # Send message
/telegram reply <msg_id> "text"  # Reply to message
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup telegram", "configure telegram bot" | `Workflows/Setup.md` |
| **Check** | "/telegram", "check telegram" | `Workflows/Check.md` |

## Authentication

Telegram uses Bot tokens from @BotFather. Stored in `~/.config/telegram-cli/`:

```bash
~/.config/telegram-cli/
├── config.json           # Bot token and settings
└── chats.json           # Cached chat IDs
```

### Required Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."  # From @BotFather
export TELEGRAM_CHAT_ID="123456789"            # Your chat ID (optional default)
```

### Getting Your Chat ID

1. Message your bot
2. Run: `bun TelegramClient.ts updates`
3. Note the `chat.id` from the response

## Tool Usage

The `Tools/TelegramClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts <command> [args]

# Commands:
#   auth                  - Test bot token
#   updates               - Get recent updates (messages to bot)
#   chats                 - List known chats
#   send <chat_id> <msg>  - Send message
#   reply <chat_id> <msg_id> <text>  - Reply to message
#   forward <from> <to> <msg_id>     - Forward message
#   photo <chat_id> <path> [caption] - Send photo
#   file <chat_id> <path> [caption]  - Send file
#   delete <chat_id> <msg_id>        - Delete message
#   me                    - Get bot info
```

## Chat References

Chats can be referenced by:
- Chat ID: `123456789` (user), `-100123456789` (group/channel)
- Username: `@username` (if public)
- Saved alias: Configure in `~/.config/telegram-cli/chats.json`

```json
{
  "aliases": {
    "me": "123456789",
    "family": "-100987654321"
  }
}
```

## Message Formatting

Telegram supports multiple formats:

```bash
# Plain text
/telegram send me "Hello world"

# Markdown
/telegram send me "*bold* _italic_ \`code\`" --parse markdown

# HTML
/telegram send me "<b>bold</b> <i>italic</i>" --parse html
```

## Examples

**Example 1: Check messages**
```
User: "/telegram"
-> Shows recent messages to bot
-> Lists unread count by chat
-> Highlights messages needing response
```

**Example 2: Send reminder to self**
```
User: "/telegram send me 'Remember to call mom'"
-> Sends message to your chat
-> Returns message ID for reference
```

**Example 3: Send to family group**
```
User: "/telegram send family 'Dinner at 7pm?'"
-> Sends to configured family group
-> Uses alias from chats.json
```

**Example 4: Share a file**
```
User: "/telegram file me ./report.pdf 'Monthly report'"
-> Uploads file to your chat
-> Includes caption
```

## Webhook vs Polling

For real-time notifications, you can set up a webhook:

```bash
# Set webhook (requires public HTTPS URL)
bun TelegramClient.ts webhook set https://your-domain.com/telegram

# Remove webhook (use polling instead)
bun TelegramClient.ts webhook delete
```

For CLI usage, polling via `updates` command is sufficient.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid bot token | Check token from @BotFather |
| `400 Bad Request: chat not found` | Invalid chat ID | Use `updates` to find correct ID |
| `403 Forbidden` | Bot blocked by user | User must unblock and /start |
| `429 Too Many Requests` | Rate limited | Wait retry_after seconds |
