---
name: Slack
description: Slack workspace integration for team messaging. USE WHEN sending slack messages, reading channels, searching slack, managing workspace communications. Invoke with /slack.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Slack/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Slack

CLI-first Slack integration using auth-keeper backend. Token-efficient - loads only when invoked.

## Quick Start

```bash
/slack                       # Show recent activity
/slack channels              # List channels
/slack read #general         # Read recent messages
/slack send #general "msg"   # Send message
```

## Backend

Uses `auth-keeper slack` for all operations. Token stored in BWS as `slack-bot-token`.

## Quick Reference

```bash
# Check status
auth-keeper status

# List channels
auth-keeper slack channels

# Read channel messages
auth-keeper slack read #general 10

# Send message
auth-keeper slack send #general "Build complete!"

# Test authentication
auth-keeper slack auth
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup slack", "configure slack" | `Workflows/Setup.md` |
| **Triage** | "/slack", "check slack" | `Workflows/Triage.md` |

## Authentication

Slack uses Bot tokens. Stored in Bitwarden Secrets Manager:

```bash
# Secret key in BWS
slack-bot-token    # xoxb-... format
```

### Required Bot Scopes

Add these scopes in Slack App settings:
- `channels:read` - List channels
- `channels:history` - Read channel messages
- `chat:write` - Send messages
- `users:read` - User info
- `im:read`, `im:write`, `im:history` - Direct messages

## Channel References

Channels can be referenced by:
- Name: `#general`, `general`
- ID: `C0123456789`

## Examples

**Example 1: Morning check-in**
```
User: "/slack"
-> Shows channels you're in
-> Lists activity overview
```

**Example 2: Send update to team**
```
User: "/slack send #engineering 'Deployment complete'"
-> auth-keeper slack send #engineering "Deployment complete"
-> Returns message timestamp
```

**Example 3: Read channel history**
```
User: "/slack read #general 20"
-> auth-keeper slack read #general 20
-> Returns last 20 messages
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_auth` | Token invalid | Check token in BWS |
| `channel_not_found` | Wrong channel name/ID | Use `channels` to list |
| `not_in_channel` | Bot not in channel | Invite bot to channel |
| `missing_scope` | Token lacks permission | Add scope in Slack app settings |
