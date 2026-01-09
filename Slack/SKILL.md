---
name: Slack
description: Slack workspace integration for team messaging. USE WHEN sending slack messages, reading channels, searching slack, managing workspace communications. Invoke with /slack.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Slack

CLI-first Slack integration using the Slack Web API. Token-efficient - loads only when invoked.

## Quick Start

```bash
/slack                       # Show recent activity
/slack channels              # List channels
/slack read #general         # Read recent messages
/slack send #general "msg"   # Send message
/slack dm @user "msg"        # Direct message
/slack search "keyword"      # Search workspace
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup slack", "configure slack" | `Workflows/Setup.md` |
| **Triage** | "/slack", "check slack" | `Workflows/Triage.md` |

## Authentication

Slack uses Bot tokens or User tokens. Stored in `~/.config/slack-cli/`:

```bash
~/.config/slack-cli/
├── credentials.json      # App credentials
└── token.json           # Bot/User token
```

### Required Environment Variables

```bash
export SLACK_BOT_TOKEN="xoxb-..."      # Bot token (recommended)
# OR
export SLACK_USER_TOKEN="xoxp-..."     # User token (more permissions)
```

### Required Bot Scopes

For bot token, add these scopes in Slack App settings:
- `channels:read` - List channels
- `channels:history` - Read channel messages
- `chat:write` - Send messages
- `users:read` - User info
- `search:read` - Search messages (user token only)
- `im:read`, `im:write`, `im:history` - Direct messages

## Tool Usage

The `Tools/SlackClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/Slack/Tools/SlackClient.ts <command> [args]

# Commands:
#   auth                  - Test authentication
#   channels              - List channels
#   read <channel> [n]    - Read last n messages (default: 20)
#   send <channel> <msg>  - Send message to channel
#   dm <user> <msg>       - Send direct message
#   thread <channel> <ts> <msg>  - Reply in thread
#   search <query>        - Search messages (user token)
#   users                 - List workspace users
#   status [text] [emoji] - Get/set status
#   react <channel> <ts> <emoji>  - Add reaction
```

## Channel References

Channels can be referenced by:
- Name: `#general`, `general`
- ID: `C0123456789`

Users can be referenced by:
- Username: `@alice`, `alice`
- ID: `U0123456789`

## Examples

**Example 1: Morning check-in**
```
User: "/slack"
-> Shows unread mentions
-> Lists active channels
-> Highlights DMs needing response
```

**Example 2: Send update to team**
```
User: "/slack send #engineering 'Deployment complete'"
-> Posts message to #engineering
-> Returns message timestamp for threading
```

**Example 3: Search for context**
```
User: "/slack search 'deployment issue from:alice'"
-> Searches workspace
-> Returns matching messages with links
```

**Example 4: Reply in thread**
```
User: "/slack thread #engineering 1234567890.123456 'Fixed in PR #789'"
-> Replies to specific thread
-> Keeps discussion organized
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_auth` | Token invalid | Check token, re-authenticate |
| `channel_not_found` | Wrong channel name/ID | Use `channels` to list |
| `not_in_channel` | Bot not in channel | Invite bot to channel |
| `missing_scope` | Token lacks permission | Add scope in Slack app settings |
| `ratelimited` | Too many requests | Wait and retry |
