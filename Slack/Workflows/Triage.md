# Slack Triage Workflow

Invoked by `/slack` or "check slack". Queries the real-time Socket Mode database for AI-assisted message triage.

## Data Source

**Primary:** `~/slack-data/messages.db` (real-time Socket Mode)
**Fallback:** `~/slack-archive/slackdump.sqlite` (hourly backup)

Triage always uses the real-time DB. Archive is only queried for historical searches.

## Workflow Steps

### 1. Check Service Status

```bash
systemctl --user is-active slack-listener
```

If not running, warn user and offer to restart.

### 2. Query Unread Messages

```bash
sqlite3 ~/slack-data/messages.db "
SELECT
  channel_type,
  channel_name,
  user_name,
  substr(text, 1, 100) as preview,
  datetime(received_at) as time
FROM messages
WHERE triage_status = 'unread'
ORDER BY
  CASE channel_type WHEN 'dm' THEN 1 WHEN 'mpim' THEN 2 ELSE 3 END,
  received_at DESC
LIMIT 50;
"
```

### 3. Get Message Counts

```bash
sqlite3 ~/slack-data/messages.db "
SELECT
  triage_status,
  channel_type,
  COUNT(*) as count
FROM messages
GROUP BY triage_status, channel_type;
"
```

### 4. Summarize by Priority

Group messages:

| Priority | Source | Why |
|----------|--------|-----|
| **High** | DMs (`dm`) | Direct communication requires response |
| **High** | Group DMs (`mpim`) | Multi-party conversations need attention |
| **Medium** | Thread replies | Ongoing conversations |
| **Low** | Channel messages | General activity |

### 5. Present Summary

```
SLACK TRIAGE - [date/time]

SERVICE: slack-listener active

UNREAD SUMMARY
  DMs: 3 messages
  Group DMs: 2 messages
  Channels: 15 messages

HIGH PRIORITY (5)
  DM from @alice (2m ago)
    "Quick question about the deployment..."

  Group DM: you, @bob, @carol (15m ago)
    "@seth can you check the SharePoint link..."

  DM from @dave (1h ago)
    "Meeting moved to 3pm"

MEDIUM PRIORITY - Threads (2)
  #engineering - "Architecture discussion"
    3 new replies since your last message

LOW PRIORITY - Channels (15)
  #engineering (8 new)
  #general (5 new)
  #random (2 new)

ACTIONS:
  /slack read dm @alice        # Read full DM
  /slack mark-read             # Mark all as read
  /slack search "sharepoint"   # Find specific message
```

### 6. Mark Messages Read (Optional)

After review, mark messages as read:

```bash
sqlite3 ~/slack-data/messages.db "
UPDATE messages
SET triage_status = 'read'
WHERE triage_status = 'unread'
  AND received_at < datetime('now');
"
```

## Quick Queries

```bash
# Unread count
sqlite3 ~/slack-data/messages.db "SELECT COUNT(*) FROM messages WHERE triage_status='unread';"

# Recent DMs
sqlite3 ~/slack-data/messages.db "SELECT user_name, text, received_at FROM messages WHERE channel_type='dm' ORDER BY received_at DESC LIMIT 10;"

# Search for keyword
sqlite3 ~/slack-data/messages.db "SELECT channel_name, user_name, text FROM messages WHERE text LIKE '%keyword%' ORDER BY received_at DESC;"

# Messages from specific user
sqlite3 ~/slack-data/messages.db "SELECT channel_name, text, received_at FROM messages WHERE user_name='alice' ORDER BY received_at DESC LIMIT 10;"
```

## Example Interaction

```
User: /slack

AI: Checking Slack messages...

SLACK TRIAGE - 2026-01-21 11:45 MST

SERVICE: slack-listener active (uptime: 2h 15m)

UNREAD: 12 messages

HIGH PRIORITY
  DM from sarah.jones (5m ago)
    "Hey, did you see the Q4 report I sent?"

  Group DM: you, mike, lisa (22m ago)
    "Can someone review the PR before EOD?"

CHANNELS (10 messages)
  #engineering - 6 new
  #general - 4 new

Would you like me to:
1. Read the DM from Sarah?
2. Check the group DM about the PR?
3. Mark all as read?
```

## Fallback to Archive

If real-time DB is empty or user asks for older messages:

```bash
# Query slackdump archive for historical data
sqlite3 ~/slack-archive/slackdump.sqlite "
SELECT c.name, u.name, m.text, datetime(m.ts, 'unixepoch')
FROM MESSAGE m
JOIN CHANNEL c ON m.channel_id = c.id
JOIN S_USER u ON m.user_id = u.id
WHERE m.text LIKE '%search_term%'
ORDER BY m.ts DESC
LIMIT 20;
"
```
