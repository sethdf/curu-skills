---
name: Telegram
description: Telegram Bot API integration for personal messaging. USE WHEN sending telegram messages, checking telegram, managing personal chats. Invoke with /telegram.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Telegram/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Telegram

CLI-first Telegram integration using auth-keeper backend. Token-efficient - loads only when invoked.

## Quick Start

```bash
/telegram                    # Show recent messages to bot
/telegram send "msg"         # Send to default chat
/telegram send 123456 "msg"  # Send to specific chat
```

## Backend

Uses `auth-keeper telegram` for all operations. Tokens stored in BWS:
- `telegram-bot-token` - Bot token from @BotFather
- `telegram-chat-id` - Default chat ID for "me"

## Quick Reference

```bash
# Check status
auth-keeper status

# Get recent updates (messages to bot)
auth-keeper telegram updates

# Send message to default chat
auth-keeper telegram send "Hello from CLI!"

# Send to specific chat
auth-keeper telegram send 123456789 "Direct message"

# Test authentication
auth-keeper telegram auth
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup telegram", "configure telegram bot" | `Workflows/Setup.md` |
| **Check** | "/telegram", "check telegram" | `Workflows/Check.md` |

## Authentication

Telegram uses Bot tokens from @BotFather. Stored in Bitwarden Secrets Manager:

```bash
# Secret keys in BWS
telegram-bot-token    # 123456:ABC-DEF... format
telegram-chat-id      # Your default chat ID
```

### Getting Your Chat ID

1. Message your bot in Telegram
2. Run: `auth-keeper telegram updates`
3. Note the `Chat ID` from the response

## Chat References

Chats can be referenced by:
- Chat ID: `123456789` (user), `-100123456789` (group/channel)
- `me` - Uses default chat from `telegram-chat-id`

## Examples

**Example 1: Check messages**
```
User: "/telegram"
-> auth-keeper telegram updates
-> Shows recent messages to bot
-> Lists chat IDs for reference
```

**Example 2: Send reminder to self**
```
User: "/telegram send 'Remember to call mom'"
-> auth-keeper telegram send "Remember to call mom"
-> Sends to default chat (telegram-chat-id)
-> Returns message ID
```

**Example 3: Send to specific chat**
```
User: "/telegram send 123456789 'Hello!'"
-> auth-keeper telegram send 123456789 "Hello!"
-> Sends to specified chat ID
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid bot token | Check token in BWS |
| `400 Bad Request: chat not found` | Invalid chat ID | Use `updates` to find correct ID |
| `403 Forbidden` | Bot blocked by user | User must unblock and /start |
| `429 Too Many Requests` | Rate limited | Wait and retry |
