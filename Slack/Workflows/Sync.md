# Sync Workflow

Incremental Slack archive using slackdump.

## Prerequisites

- `slackdump` binary installed (`/usr/local/bin/slackdump`)
- User token imported to slackdump workspace (`slackdump workspace list`)
- Archive directory exists

## Step 1: Check Slackdump Status

```bash
# Verify slackdump is configured
slackdump workspace list
```

Expected output shows the workspace name (e.g., "audiense").

## Step 2: Determine Archive State

```bash
ARCHIVE_DIR="$HOME/slack-archive"

if [[ -f "$ARCHIVE_DIR/slackdump.sqlite" ]]; then
    echo "Existing archive found - will resume"
    SYNC_CMD="slackdump resume"
else
    echo "No archive - will create new"
    SYNC_CMD="slackdump archive"
    mkdir -p "$ARCHIVE_DIR"
fi
```

## Step 3: Run Sync

### First Run (Full Archive)

```bash
slackdump archive -o ~/slack-archive/
```

This creates:
- `~/slack-archive/slackdump.sqlite` - SQLite database with all messages
- `~/slack-archive/__uploads/` - Downloaded files (if enabled)

### Incremental Sync

```bash
slackdump resume ~/slack-archive/
```

Only fetches messages newer than last sync.

## Step 4: Verify Results

```bash
# Check message count
sqlite3 ~/slack-archive/slackdump.sqlite "SELECT COUNT(*) FROM MESSAGE;"

# Latest messages
sqlite3 ~/slack-archive/slackdump.sqlite \
  "SELECT datetime(ts, 'unixepoch'), text FROM MESSAGE ORDER BY ts DESC LIMIT 5;"

# Check last sync time
sqlite3 ~/slack-archive/slackdump.sqlite \
  "SELECT datetime(MAX(ts), 'unixepoch') FROM MESSAGE;"
```

## Step 5: Output Summary

```
Slack Sync Complete

**Archive:** ~/slack-archive/slackdump.sqlite
**Messages:** 12,345
**Channels:** 21
**Last message:** 2026-01-19 21:30:00
**New since last sync:** 47
```

## Automation (Optional)

### Cron-based sync

```bash
# Edit crontab
crontab -e

# Add line for every 5 minutes
*/5 * * * * slackdump resume ~/slack-archive/ 2>&1 | logger -t slackdump
```

### Systemd timer

```ini
# ~/.config/systemd/user/slack-sync.timer
[Unit]
Description=Slack archive sync timer

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

## Querying the Archive

### Recent messages from a channel

```sql
SELECT datetime(m.ts, 'unixepoch') as time, u.name, m.text
FROM MESSAGE m
JOIN S_USER u ON m.user = u.id
JOIN CHANNEL c ON m.channel_id = c.id
WHERE c.name = 'general'
ORDER BY m.ts DESC
LIMIT 20;
```

### Search messages

```sql
SELECT datetime(ts, 'unixepoch'), text
FROM MESSAGE
WHERE text LIKE '%deploy%'
ORDER BY ts DESC;
```

### Messages by user

```sql
SELECT datetime(m.ts, 'unixepoch'), m.text
FROM MESSAGE m
JOIN S_USER u ON m.user = u.id
WHERE u.name = 'seth'
ORDER BY m.ts DESC
LIMIT 20;
```

## Integration with Libretto

The SQLite archive can be ingested into Libretto for RAG:

```bash
# Export to JSONL for ingestion
sqlite3 ~/slack-archive/slackdump.sqlite -json \
  "SELECT * FROM MESSAGE WHERE ts > strftime('%s', 'now', '-1 day');" \
  > ~/libretto/ingest/slack-$(date +%Y%m%d).jsonl
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `no authenticated workspaces` | Token not imported | Run `slackdump workspace import` |
| `rate limited` | Too many requests | Slackdump auto-retries; wait |
| `database locked` | Concurrent access | Stop other processes accessing DB |
