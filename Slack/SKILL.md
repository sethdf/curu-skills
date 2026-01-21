---
name: Slack
description: Slack workspace integration for team messaging. USE WHEN sending slack messages, reading channels, searching slack, managing workspace communications. Invoke with /slack.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Slack/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Slack

Real-time Slack integration via Socket Mode with AI-assisted triage. Messages arrive instantly via WebSocket and are stored locally for intelligent processing.

## Architecture

```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│   Slack API     │ ───────────────► │  SlackListener   │
│  (Socket Mode)  │    Real-time     │   (systemd)      │
└─────────────────┘                  └────────┬─────────┘
                                              │
                                              ▼
┌─────────────────┐                  ┌──────────────────┐
│   Slackdump     │ ────────────────►│  SQLite DBs      │
│  (hourly cron)  │     Backup       │                  │
└─────────────────┘                  │  Primary:        │
                                     │  ~/slack-data/   │
                                     │  messages.db     │
                                     │                  │
                                     │  Archive:        │
                                     │  ~/slack-archive/│
                                     │  slackdump.sqlite│
                                     └──────────────────┘
```

## Data Sources

| Source | Type | Location | Use Case |
|--------|------|----------|----------|
| **Real-time DB** | Primary | `~/slack-data/messages.db` | Triage, recent messages, AI processing |
| **Archive DB** | Backup | `~/slack-archive/slackdump.sqlite` | Historical search, older messages |

**Triage always queries real-time DB first.** Archive is only used when searching historical data beyond the real-time window.

## Quick Start

```bash
/slack                       # Triage - show unread messages
/slack status                # Check listener and database status
/slack search "keyword"      # Search messages
/slack send #general "msg"   # Send message (via auth-keeper)
```

## Services

### Socket Mode Listener (Primary)

Real-time message capture via WebSocket. Runs as systemd user service.

```bash
# Service management
systemctl --user status slack-listener
systemctl --user restart slack-listener
journalctl --user -u slack-listener -f    # Watch logs

# Database location
~/slack-data/messages.db
```

**Captured Events:**
- `message.im` - Direct messages
- `message.mpim` - Group DMs (multi-party)
- `message.channels` - Public channels
- `message.groups` - Private channels

### Slackdump Archive (Backup)

Hourly incremental backup via cron. Provides historical depth.

```bash
# Cron schedule (every hour at :00)
0 * * * * slackdump resume ~/slack-archive/

# Manual sync
slackdump resume ~/slack-archive/

# Archive location
~/slack-archive/slackdump.sqlite
```

## Database Schema (Real-time)

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,           -- channel_id-ts
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  channel_type TEXT,             -- dm, mpim, channel, group_dm
  user_id TEXT,
  user_name TEXT,
  text TEXT,
  ts TEXT NOT NULL,
  thread_ts TEXT,
  received_at DATETIME,
  triage_status TEXT DEFAULT 'unread',  -- unread, read, actioned, archived
  triage_priority TEXT,          -- high, medium, low
  triage_notes TEXT,
  raw_event TEXT                 -- Full JSON for complex processing
);

-- Supporting tables
CREATE TABLE channels (id, name, type, is_member, updated_at);
CREATE TABLE users (id, name, real_name, email, updated_at);
```

## Triage Workflow

When `/slack` is invoked:

1. **Query real-time DB** for unread messages
2. **Group by priority:**
   - DMs and mentions → High
   - Thread replies → Medium
   - Channel messages → Low
3. **Present summary** with quick actions
4. **Mark as read** after review

```sql
-- Get unread messages for triage
SELECT channel_name, channel_type, user_name, text, received_at
FROM messages
WHERE triage_status = 'unread'
ORDER BY
  CASE channel_type WHEN 'dm' THEN 1 WHEN 'mpim' THEN 2 ELSE 3 END,
  received_at DESC;
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Triage** | "/slack", "check slack", "slack messages" | `Workflows/Triage.md` |
| **Setup** | "setup slack", "configure slack" | `Workflows/Setup.md` |
| **Sync** | "sync slack", "archive slack" | `Workflows/Sync.md` |

## Authentication

Three tokens stored in BWS (Bitwarden Secrets):

| Token | Format | Purpose |
|-------|--------|---------|
| `slack-app-token` | xapp-... | Socket Mode connection |
| `slack-user-token` | xoxp-... | API calls (acts as user) |
| `slack-bot-token` | xoxb-... | Legacy/backup |

### Required Scopes

**App-Level Token:**
- `connections:write` - Socket Mode

**User Token (Event Subscriptions):**
- `message.im` - DM events
- `message.mpim` - Group DM events
- `message.channels` - Channel events
- `message.groups` - Private channel events

## Tools

| Tool | Purpose | Location |
|------|---------|----------|
| `SlackListener.ts` | Socket Mode daemon | `Tools/SlackListener.ts` |

```bash
# Manual listener (for testing)
bun ~/.claude/skills/Slack/Tools/SlackListener.ts

# Check status
bun ~/.claude/skills/Slack/Tools/SlackListener.ts --status

# Initialize database only
bun ~/.claude/skills/Slack/Tools/SlackListener.ts --init-db
```

## Examples

**Example 1: Morning triage**
```
User: "/slack"
-> Queries real-time DB for unread messages
-> Groups by DMs, mentions, channels
-> Shows summary with counts
-> Offers quick actions
```

**Example 2: Search for a link**
```
User: "find the sharepoint link from this morning"
-> Searches real-time DB: SELECT * FROM messages WHERE text LIKE '%sharepoint%'
-> If not found, falls back to archive DB
-> Returns matching messages with context
```

**Example 3: Check listener status**
```
User: "/slack status"
-> systemctl --user status slack-listener
-> Shows message counts from DB
-> Reports last received message time
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Disconnected from Socket Mode` | Network issue | Service auto-restarts (RestartSec=10) |
| `Missing access token` | BWS not accessible | Check `~/.config/slack-listener/env` |
| `No messages found` | DB empty or listener not running | Check `systemctl --user status slack-listener` |
| `Secret not found in BWS` | Token not stored | Add token to BWS with correct key name |

## Logs

```bash
# Real-time listener logs
journalctl --user -u slack-listener -f

# Slackdump sync logs
tail -f ~/logs/slackdump.log
```
