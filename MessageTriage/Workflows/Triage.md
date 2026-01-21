# Triage Workflow

**Interactive message triage - defaults to instant cached results.**

Cron jobs continuously export and categorize messages in the background. Interactive queries just read from cache for instant results.

## Default Behavior: Cached (Instant)

When user asks to "triage inbox" or "check messages", **default to cached results**:

```bash
bun Tools/AutoTriage.ts --source email --cached
```

This returns instantly from SQLite cache - no API calls, no AI inference.

## When to Use Fresh Mode

Only use `--fresh` when user explicitly asks:
- "get current/latest emails"
- "refresh triage"
- "re-categorize messages"

```bash
bun Tools/AutoTriage.ts --source email --fresh --limit 50
```

## Step 1: Detect Source

| User Says | Source | Data Location |
|-----------|--------|---------------|
| "inbox", "email", "ms365", "outlook" | `email` | `~/.cache/message-triage/messages.sqlite` |
| "#channel", "slack", "channel" | `slack` | `~/slack-data/messages.db` (real-time) |
| Default | `email` | |

## Step 2: Query Cache

### For Email (Cached via Cron)

```bash
# Instant cached results (5-min cron keeps this fresh)
bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts \
  --source email \
  --cached
```

### For Slack (Real-time DB)

```sql
-- Query real-time DB directly (Socket Mode keeps this current)
sqlite3 ~/slack-data/messages.db "
  SELECT
    channel_type,
    channel_name,
    user_name,
    substr(text, 1, 80) AS preview,
    datetime(timestamp, 'unixepoch') AS time,
    triage_status
  FROM messages
  WHERE triage_status = 'unread'
  ORDER BY
    CASE channel_type
      WHEN 'im' THEN 1       -- DMs first
      WHEN 'mpim' THEN 2     -- Group DMs
      WHEN 'thread' THEN 3   -- Thread replies
      ELSE 4                 -- Channels last
    END,
    timestamp DESC
  LIMIT 50;
"
```

**Output includes:**
- Total messages (last 24 hours)
- Action-required count
- Category breakdown
- Top action items with confidence scores
- For Slack: Priority grouping (DMs → Group DMs → Threads → Channels)

## Step 3: Present Results

### Email Results

```markdown
## Email Triage Summary

**Action Required:** 12 messages need attention
**Total Categorized:** 127 messages (last 24 hours)

### By Category
| Category | Count | Avg Confidence |
|----------|-------|----------------|
| SaaS-Notifications | 45 | 9.5 |
| FYI-Internal | 31 | 8.1 |
| Colleagues | 23 | 8.4 |
| Vendor-Sales | 16 | 7.8 |
| Action-Required | 12 | 7.2 |

### Action Required Items
1. alice@example.com - "Budget approval needed" (conf: 9)
2. bob@example.com - "PR review request" (conf: 8)
...
```

### Slack Results (Priority Grouped)

```markdown
## Slack Triage Summary

**Unread:** 23 messages need attention

### Direct Messages (Priority 1)
| From | Preview | Time |
|------|---------|------|
| @alice | "Hey, quick question about..." | 10:23 AM |
| @bob | "Can you review this PR?" | 9:45 AM |

### Group DMs (Priority 2)
| Channel | From | Preview | Time |
|---------|------|---------|------|
| alice, bob, you | @alice | "Team sync notes..." | 9:30 AM |

### Thread Replies (Priority 3)
| Thread | From | Preview | Time |
|--------|------|---------|------|
| #dev: "API discussion" | @charlie | "I agree with..." | 9:15 AM |

### Channels (Priority 4)
| Channel | From | Preview | Time |
|---------|------|---------|------|
| #general | @dave | "Reminder: standup..." | 9:00 AM |
```

## Step 4: Offer Actions (Optional)

If user wants to act on results:

### Email Actions

**Archive by Category:**
```bash
# User: "Archive all SaaS notifications"
# → Query cache for SaaS-Notifications IDs
# → Bulk move to archive via MS365
```

**Mark as Read:**
```bash
# User: "Mark all FYI-Internal as read"
# → Query cache for FYI-Internal IDs
# → Bulk update via MS365
```

### Slack Actions

**Mark as Read (update triage_status):**
```sql
-- Mark all channel messages as read
UPDATE messages
SET triage_status = 'read'
WHERE channel_type = 'channel'
  AND triage_status = 'unread';
```

**Mark Specific Messages:**
```sql
-- Mark specific messages as actioned
UPDATE messages
SET triage_status = 'actioned'
WHERE ts IN ('1234567890.123456', '1234567890.123457');
```

## Fresh Mode (On Request)

When user explicitly requests fresh data:

```bash
# Full export + AI categorization
bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts \
  --source email \
  --fresh \
  --limit 100 \
  --verbose
```

This takes 30-60 seconds depending on message count.

## Background Data Collection

| Source | Method | Frequency | Service |
|--------|--------|-----------|---------|
| Email | Cron polling | Every 5 min | `autotriage` cron |
| Slack | Socket Mode | Real-time | `slack-socket-listener` systemd |

### Email (Cron)

```cron
# Email: every 5 minutes (keeps cache fresh)
*/5 * * * * bun /path/to/AutoTriage.ts --source email --quiet
```

### Slack (Real-time)

Slack uses Socket Mode via systemd - no cron needed:

```bash
# Check status
systemctl --user status slack-socket-listener

# Messages flow: Slack API → WebSocket → ~/slack-data/messages.db
```

With these running, interactive queries are always instant.

## Decision Tree

```
User: "Triage my inbox"
         │
         ▼
    ┌─────────────────┐
    │ Explicit fresh? │
    │ ("current",     │
    │  "refresh",     │
    │  "re-categorize")│
    └────────┬────────┘
             │
      No     │     Yes
      ▼      │      ▼
  ┌──────┐   │  ┌──────────┐
  │--cached│  │  │--fresh   │
  │Instant │  │  │30-60 sec │
  └──────┘   │  └──────────┘
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Empty cache | "No cached results. Running fresh triage..." → --fresh |
| Stale cache (>1 hour) | Show results + "Cache is 2 hours old. Run fresh?" |
| Cache DB missing | Initialize + run --fresh |
