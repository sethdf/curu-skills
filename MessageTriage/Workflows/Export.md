# Export Workflow

**Export messages from any source to local SQLite cache for offline AI categorization.**

Use this workflow when you want to cache messages locally for review, analysis, or offline processing.

## Prerequisites

- Source-specific authentication configured
- `sqlite3` available
- Write access to cache directory

## Step 1: Initialize Cache Database

Create or open the local cache:

```bash
CACHE_DIR="${HOME}/.cache/message-triage"
CACHE_DB="${CACHE_DIR}/messages.sqlite"

mkdir -p "$CACHE_DIR"

sqlite3 "$CACHE_DB" << 'SQL'
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  timestamp TEXT,
  from_name TEXT,
  from_address TEXT,
  subject TEXT,
  body TEXT,
  body_preview TEXT,
  thread_id TEXT,
  is_read INTEGER DEFAULT 0,
  category TEXT,
  confidence INTEGER,
  reasoning TEXT,
  exported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thread_context (
  message_id TEXT,
  position INTEGER,
  from_name TEXT,
  from_address TEXT,
  body_preview TEXT,
  timestamp TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);
CREATE INDEX IF NOT EXISTS idx_thread_message ON thread_context(message_id);
SQL
```

## Step 2: Export from Source

### Email (MS365)

```bash
# Get unread inbox messages as JSON
MESSAGES=$(zsh -ic 'auth-keeper ms365 "
  \$inbox = Get-MgUserMailFolder -UserId \"sfoley@buxtonco.com\" | Where-Object { \$_.DisplayName -eq \"Inbox\" }
  Get-MgUserMailFolderMessage -UserId \"sfoley@buxtonco.com\" -MailFolderId \$inbox.Id -Filter \"isRead eq false\" -Top 500 -Select \"id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead\" | ConvertTo-Json -Depth 5
"')

# Parse and insert (using jq + sqlite3)
echo "$MESSAGES" | jq -c '.[]' | while read -r msg; do
  ID=$(echo "$msg" | jq -r '.id')
  SUBJECT=$(echo "$msg" | jq -r '.subject // ""' | sed "s/'/''/g")
  FROM_NAME=$(echo "$msg" | jq -r '.from.emailAddress.name // ""' | sed "s/'/''/g")
  FROM_ADDR=$(echo "$msg" | jq -r '.from.emailAddress.address // ""')
  TIMESTAMP=$(echo "$msg" | jq -r '.receivedDateTime // ""')
  PREVIEW=$(echo "$msg" | jq -r '.bodyPreview // ""' | sed "s/'/''/g")
  THREAD_ID=$(echo "$msg" | jq -r '.conversationId // ""')
  IS_READ=$(echo "$msg" | jq -r 'if .isRead then 1 else 0 end')

  sqlite3 "$CACHE_DB" "
    INSERT OR REPLACE INTO messages (id, source, timestamp, from_name, from_address, subject, body_preview, thread_id, is_read)
    VALUES ('$ID', 'email', '$TIMESTAMP', '$FROM_NAME', '$FROM_ADDR', '$SUBJECT', '$PREVIEW', '$THREAD_ID', $IS_READ);
  "
done
```

### Slack (from slackdump archive)

```bash
SLACK_ARCHIVE="${HOME}/slack-archive/slackdump.sqlite"

# Export to message-triage cache
sqlite3 "$SLACK_ARCHIVE" << SQL | sqlite3 "$CACHE_DB"
.mode insert messages
SELECT
  m.ts,
  'slack',
  datetime(CAST(m.ts AS REAL), 'unixepoch'),
  COALESCE(u.real_name, m.user),
  m.user,
  '#' || c.name,
  m.text,
  substr(m.text, 1, 200),
  COALESCE(m.thread_ts, m.ts),
  0,
  NULL, NULL, NULL,
  datetime('now')
FROM MESSAGE m
LEFT JOIN S_USER u ON m.user = u.id
LEFT JOIN CHANNEL c ON m.channel_id = c.id
WHERE datetime(CAST(m.ts AS REAL), 'unixepoch') > datetime('now', '-7 days')
ORDER BY m.ts DESC
LIMIT 500;
SQL
```

## Step 3: Export Thread Context

For each unique thread_id, gather context:

### Email Threads

```bash
# Get unique conversation IDs
CONV_IDS=$(sqlite3 "$CACHE_DB" "SELECT DISTINCT thread_id FROM messages WHERE source='email' AND thread_id IS NOT NULL")

for CONV_ID in $CONV_IDS; do
  # Fetch thread from MS365
  THREAD=$(zsh -ic "auth-keeper ms365 \"
    Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Filter \\\"conversationId eq '\$CONV_ID'\\\" -OrderBy 'receivedDateTime' -Top 5 -Select 'id,from,receivedDateTime,bodyPreview' | ConvertTo-Json -Depth 5
  \"")

  # Get message IDs in this conversation
  MSG_IDS=$(sqlite3 "$CACHE_DB" "SELECT id FROM messages WHERE thread_id='$CONV_ID'")

  # Insert thread context for each message
  POS=1
  echo "$THREAD" | jq -c '.[]' | while read -r ctx; do
    CTX_FROM=$(echo "$ctx" | jq -r '.from.emailAddress.name // ""' | sed "s/'/''/g")
    CTX_ADDR=$(echo "$ctx" | jq -r '.from.emailAddress.address // ""')
    CTX_PREVIEW=$(echo "$ctx" | jq -r '.bodyPreview // ""' | sed "s/'/''/g")
    CTX_TS=$(echo "$ctx" | jq -r '.receivedDateTime // ""')

    for MSG_ID in $MSG_IDS; do
      sqlite3 "$CACHE_DB" "
        INSERT INTO thread_context (message_id, position, from_name, from_address, body_preview, timestamp)
        VALUES ('$MSG_ID', $POS, '$CTX_FROM', '$CTX_ADDR', '$CTX_PREVIEW', '$CTX_TS');
      "
    done
    POS=$((POS + 1))
  done
done
```

### Slack Threads

```bash
# Get threads from slackdump
sqlite3 "$SLACK_ARCHIVE" << SQL | while read -r line; do
  PARENT_TS=$(echo "$line" | cut -d'|' -f1)
  MSG_ID=$(echo "$line" | cut -d'|' -f2)

  # Get thread replies
  sqlite3 "$SLACK_ARCHIVE" "
    SELECT
      '$MSG_ID',
      ROW_NUMBER() OVER (ORDER BY ts),
      COALESCE(u.real_name, m.user),
      m.user,
      substr(m.text, 1, 200),
      datetime(CAST(m.ts AS REAL), 'unixepoch')
    FROM MESSAGE m
    LEFT JOIN S_USER u ON m.user = u.id
    WHERE m.thread_ts = '$PARENT_TS' OR m.ts = '$PARENT_TS'
    ORDER BY m.ts
    LIMIT 10;
  " | sqlite3 "$CACHE_DB" ".mode insert thread_context" ".import /dev/stdin thread_context"
done << SQL
SELECT DISTINCT
  COALESCE(m.thread_ts, m.ts) as parent,
  m.ts as msg_id
FROM MESSAGE m
WHERE m.thread_ts IS NOT NULL
SQL
```

## Step 4: Verify Export

```bash
# Summary stats
sqlite3 "$CACHE_DB" << 'SQL'
.mode column
.headers on

SELECT '=== Export Summary ===' as '';

SELECT source, COUNT(*) as message_count
FROM messages
GROUP BY source;

SELECT '=== Thread Context ===' as '';

SELECT
  m.source,
  COUNT(DISTINCT m.id) as messages_with_context,
  COUNT(tc.message_id) as total_context_entries
FROM messages m
LEFT JOIN thread_context tc ON m.id = tc.message_id
GROUP BY m.source;

SELECT '=== Recent Exports ===' as '';

SELECT source, MIN(exported_at) as oldest, MAX(exported_at) as newest
FROM messages
GROUP BY source;
SQL
```

## Output

Report to user:

```markdown
## Export Complete

**Cache Location:** ~/.cache/message-triage/messages.sqlite
**Export Time:** 2024-01-15 10:30:00

### Messages Exported

| Source | Count | With Thread Context |
|--------|-------|---------------------|
| Email | 127 | 89 |
| Slack | 342 | 156 |

### Next Steps

1. Run Categorize workflow to AI-classify messages
2. Review low-confidence categorizations
3. Apply bulk actions via Triage workflow

**Query the cache:**
```bash
sqlite3 ~/.cache/message-triage/messages.sqlite "SELECT * FROM messages LIMIT 10;"
```
```

## Incremental Export

For subsequent exports, only fetch new messages:

```bash
# Get latest timestamp per source
LAST_EMAIL=$(sqlite3 "$CACHE_DB" "SELECT MAX(timestamp) FROM messages WHERE source='email'")
LAST_SLACK=$(sqlite3 "$CACHE_DB" "SELECT MAX(timestamp) FROM messages WHERE source='slack'")

# Filter exports by timestamp
# Email: -Filter "receivedDateTime gt $LAST_EMAIL"
# Slack: WHERE datetime(...) > '$LAST_SLACK'
```
