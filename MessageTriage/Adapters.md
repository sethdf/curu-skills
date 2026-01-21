# Source Adapters

**SOP for handling messages from different sources (Email, Slack, etc.)**

Each source has a dedicated adapter that normalizes messages into a common format for AI categorization.

## Common Message Format

All adapters output messages in this normalized format:

```json
{
  "id": "unique-message-id",
  "source": "email|slack|signal|...",
  "timestamp": "2024-01-15T10:30:00Z",
  "from": {
    "name": "Alice Smith",
    "address": "alice@example.com"
  },
  "subject": "Re: Q4 Budget Review",
  "body": "Message content...",
  "body_preview": "First 200 chars...",
  "thread_id": "conversation-thread-id",
  "thread_context": [...],
  "metadata": {
    "source_specific": "fields"
  }
}
```

## Email Adapter (MS365)

### Configuration

```bash
# Authentication via auth-keeper
auth-keeper ms365 "Get-MgUser -UserId me"

# User ID
USER_ID="sfoley@buxtonco.com"
```

### Export Commands

```powershell
# Get unread inbox messages
Get-MgUserMailFolderMessage -UserId '$USER_ID' `
  -MailFolderId 'inbox' `
  -Filter 'isRead eq false' `
  -Select 'id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead' `
  -Top 100

# Get full message with body
Get-MgUserMessage -UserId '$USER_ID' -MessageId '$id' `
  -Select 'id,subject,from,toRecipients,receivedDateTime,body,conversationId'

# Get thread by conversationId
Get-MgUserMessage -UserId '$USER_ID' `
  -Filter "conversationId eq '$convId'" `
  -OrderBy 'receivedDateTime' `
  -Select 'subject,from,receivedDateTime,bodyPreview'
```

### Field Mapping

| MS365 Field | Common Format |
|-------------|---------------|
| `id` | `id` |
| `from.emailAddress.address` | `from.address` |
| `from.emailAddress.name` | `from.name` |
| `subject` | `subject` |
| `bodyPreview` | `body_preview` |
| `body.content` | `body` |
| `conversationId` | `thread_id` |
| `receivedDateTime` | `timestamp` |

### Bulk Export to SQLite

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  source TEXT DEFAULT 'email',
  timestamp TEXT,
  from_name TEXT,
  from_address TEXT,
  subject TEXT,
  body TEXT,
  body_preview TEXT,
  thread_id TEXT,
  is_read INTEGER,
  category TEXT,
  confidence INTEGER,
  reasoning TEXT
);

CREATE INDEX idx_thread ON messages(thread_id);
CREATE INDEX idx_timestamp ON messages(timestamp);
CREATE INDEX idx_category ON messages(category);
```

## Slack Adapter

### Architecture: Dual Database

```
┌─────────────────────────────────────────────────────────────┐
│                     Slack Data Sources                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │  Socket Mode     │         │     Slackdump Backup     │  │
│  │  (Real-time)     │         │     (Hourly cron)        │  │
│  └────────┬─────────┘         └────────────┬─────────────┘  │
│           │                                 │                │
│           ▼                                 ▼                │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │ ~/slack-data/    │         │ ~/slack-archive/         │  │
│  │ messages.db      │         │ slackdump.sqlite         │  │
│  │ (PRIMARY)        │         │ (HISTORICAL ONLY)        │  │
│  └──────────────────┘         └──────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuration

```bash
# Primary: Real-time database (Socket Mode)
SLACK_REALTIME_DB="$HOME/slack-data/messages.db"

# Secondary: Archive database (historical searches only)
SLACK_ARCHIVE_DB="$HOME/slack-archive/slackdump.sqlite"
```

### Data Source Priority

| Operation | Primary Source | Fallback |
|-----------|----------------|----------|
| Triage (recent) | Real-time DB | - |
| Search (recent) | Real-time DB | Archive DB |
| Search (historical) | Archive DB | - |
| Thread context | Real-time DB | Archive DB |

### Real-time DB Queries (Primary)

```sql
-- Get unread messages by priority: DMs > Group DMs > Threads > Channels
SELECT
  m.ts AS id,
  'slack' AS source,
  datetime(m.timestamp, 'unixepoch') AS timestamp,
  m.user_name AS from_name,
  m.user_id AS from_address,
  m.channel_name AS subject,
  m.text AS body,
  substr(m.text, 1, 200) AS body_preview,
  COALESCE(m.thread_ts, m.ts) AS thread_id,
  m.channel_type,
  m.triage_status
FROM messages m
WHERE m.triage_status = 'unread'
ORDER BY
  CASE m.channel_type
    WHEN 'im' THEN 1
    WHEN 'mpim' THEN 2
    WHEN 'thread' THEN 3
    ELSE 4
  END,
  m.timestamp DESC
LIMIT 100;

-- Get thread messages from real-time DB
SELECT
  m.ts AS id,
  datetime(m.timestamp, 'unixepoch') AS timestamp,
  m.user_name AS from_name,
  m.text AS body
FROM messages m
WHERE m.thread_ts = '$parent_ts'
   OR m.ts = '$parent_ts'
ORDER BY m.timestamp;

-- Mark messages as read
UPDATE messages
SET triage_status = 'read'
WHERE ts IN ($message_ids);
```

### Archive DB Queries (Historical Only)

```sql
-- Search historical messages (fallback)
SELECT
  m.ts AS id,
  'slack' AS source,
  datetime(CAST(m.ts AS REAL), 'unixepoch') AS timestamp,
  u.real_name AS from_name,
  m.user AS from_address,
  c.name AS subject,
  m.text AS body,
  substr(m.text, 1, 200) AS body_preview,
  COALESCE(m.thread_ts, m.ts) AS thread_id
FROM MESSAGE m
LEFT JOIN S_USER u ON m.user = u.id
LEFT JOIN CHANNEL c ON m.channel_id = c.id
WHERE m.text LIKE '%search_term%'
  AND datetime(CAST(m.ts AS REAL), 'unixepoch') < datetime('now', '-24 hours')
ORDER BY m.ts DESC
LIMIT 100;
```

### Slackdump Backup (Cron)

```bash
# Hourly backup to archive (runs via cron)
0 * * * * slackdump resume ~/slack-archive/
```

### Field Mapping

| Slack Field | Common Format |
|-------------|---------------|
| `ts` | `id` |
| `user_id` / `user` | `from.address` |
| `user_name` / `real_name` | `from.name` |
| `channel_name` | `subject` (as channel name) |
| `text` | `body` |
| `thread_ts` or `ts` | `thread_id` |
| `timestamp` / `ts` | `timestamp` |
| `channel_type` | `metadata.channel_type` |
| `triage_status` | `metadata.triage_status` |

## Future Adapters

### Signal (via signal-cli)

```bash
# Receive messages
signal-cli -a +1234567890 receive --json

# Field mapping would be:
# timestamp → timestamp
# sourceNumber → from.address
# sourceName → from.name
# message → body
# quote.id → thread_id (for replies)
```

### SimpleX (via simplex-chat)

```bash
# List recent messages
simplex-chat -e '/last'

# Would need parsing of simplex-chat output
```

### Teams (future)

```powershell
# Would use Microsoft Graph API
# Get-MgChatMessage, Get-MgTeamChannelMessage
```

## Adapter Interface

Each adapter must implement:

```typescript
interface MessageAdapter {
  source: string;

  // Export messages to common format
  export(options: ExportOptions): Promise<Message[]>;

  // Get thread context for a message
  getThreadContext(messageId: string): Promise<Message[]>;

  // Apply category back to source (optional)
  applyCategory?(messageId: string, category: string): Promise<void>;
}

interface ExportOptions {
  limit?: number;
  since?: Date;
  filter?: {
    unreadOnly?: boolean;
    channel?: string;
    sender?: string;
  };
}
```

## Source Detection

When user doesn't specify source, detect from context:

| Trigger | Detected Source |
|---------|-----------------|
| "inbox", "email", "ms365" | `email` |
| "#channel", "slack" | `slack` |
| "signal", "sms" | `signal` |
| "simplex" | `simplex` |

**Default:** `email` (most common triage target)
