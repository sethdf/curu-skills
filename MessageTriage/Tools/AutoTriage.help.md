# AutoTriage CLI Tool

Headless message triage for cron/scheduled execution. Runs without a Claude Code session.

## Synopsis

```bash
bun AutoTriage.ts --source <email|slack> [options]
```

## Description

AutoTriage is a standalone CLI tool that:
1. Exports messages from MS365 or Slack
2. Caches them locally in SQLite
3. Runs AI categorization via PAI Inference (Sonnet)
4. Optionally sends notifications on completion

Designed for cron jobs and scheduled automation.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--source <email\|slack>` | Message source (required) | - |
| `--channel <name>` | Slack channel (required for slack) | - |
| `--limit <n>` | Max messages to process | 100 |
| `--cached` | Query cached results only (instant, no API calls) | false |
| `--fresh` | Force fresh export + AI categorization | false |
| `--notify` | Send notification on completion | false |
| `--dry-run` | Export/categorize but don't apply actions | false |
| `--quiet` | Minimal output (for cron) | false |
| `--verbose` | Detailed debug output | false |
| `--help` | Show help | - |

## Usage Modes

### Cached Mode (Default for Interactive)
```bash
# Instant results from SQLite cache - no API calls
bun AutoTriage.ts --source email --cached
```
Use this when cron keeps the cache fresh. Returns instantly.

### Fresh Mode (Background/Cron)
```bash
# Full export + AI categorization
bun AutoTriage.ts --source email --fresh --limit 100
```
Use this for cron jobs or when explicitly requesting current data.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MS365_USER` | MS365 user email | sfoley@buxtonco.com |
| `SLACK_ARCHIVE` | Path to slackdump SQLite | ~/slack-archive/slackdump.sqlite |
| `TRIAGE_CACHE` | Path to cache database | ~/.cache/message-triage/messages.sqlite |
| `NOTIFY_URL` | Notification endpoint | http://localhost:8888/notify |

## Examples

### Basic Email Triage
```bash
bun AutoTriage.ts --source email
```

### Email with Notification
```bash
bun AutoTriage.ts --source email --limit 50 --notify
```

### Slack Channel Triage
```bash
bun AutoTriage.ts --source slack --channel support --notify
```

### Dry Run with Verbose Output
```bash
bun AutoTriage.ts --source email --dry-run --verbose
```

### Cron-Friendly (Quiet Mode)
```bash
bun AutoTriage.ts --source email --notify --quiet
```

## Cron Setup

### Every 4 Hours
```cron
0 */4 * * * ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet 2>&1 | logger -t autotriage
```

### Daily at 8 AM
```cron
0 8 * * * ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --limit 200 --notify --quiet
```

### Weekdays at 9 AM and 2 PM
```cron
0 9,14 * * 1-5 ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet
```

## Systemd Timer (Alternative)

Create `/etc/systemd/system/autotriage.service`:
```ini
[Unit]
Description=AutoTriage Email Categorization
After=network.target

[Service]
Type=oneshot
User=ubuntu
ExecStart=/usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet
Environment=HOME=/home/ubuntu
```

Create `/etc/systemd/system/autotriage.timer`:
```ini
[Unit]
Description=Run AutoTriage every 4 hours

[Timer]
OnCalendar=*-*-* 0/4:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable autotriage.timer
sudo systemctl start autotriage.timer
```

## Output

### Standard Output
```
[INFO] Starting AutoTriage run: run-1705312800000
[OK] Exported 127 emails to cache
[OK] Categorized 127 messages

=== AutoTriage Report ===
Run ID: run-1705312800000
Total Messages: 127
Action Required: 12

category            count  avg_conf
------------------  -----  --------
SaaS-Notifications  45     9.5
FYI-Internal        31     8.1
Colleagues          23     8.4
Vendor-Sales        16     7.8
Action-Required     12     7.2

[OK] Notification sent
[OK] AutoTriage complete: 127 messages processed, 127 categorized
```

### Quiet Output (Cron)
```
[OK] AutoTriage complete: 127 messages processed, 127 categorized
```

## Database Schema

The tool maintains a SQLite cache at `~/.cache/message-triage/messages.sqlite`:

### Tables
- `messages` - Cached messages with categories
- `thread_context` - Thread/conversation context
- `triage_runs` - Run history and statistics

### Querying Results
```bash
# Recent runs
sqlite3 ~/.cache/message-triage/messages.sqlite "
  SELECT id, source, started_at, messages_processed, status
  FROM triage_runs
  ORDER BY started_at DESC
  LIMIT 10;
"

# Action-required messages
sqlite3 ~/.cache/message-triage/messages.sqlite "
  SELECT from_address, subject, confidence
  FROM messages
  WHERE category = 'Action-Required'
  ORDER BY confidence DESC;
"

# Category distribution
sqlite3 ~/.cache/message-triage/messages.sqlite "
  SELECT category, COUNT(*) as count
  FROM messages
  GROUP BY category
  ORDER BY count DESC;
"
```

## Troubleshooting

### auth-keeper not found
```bash
# Ensure running in interactive shell context
zsh -ic 'auth-keeper status'
```

### MS365 token expired
```bash
auth-keeper ms365 --auth
```

### Slack archive not found
```bash
# Run initial sync
slackdump archive -o ~/slack-archive/
```

### PAI Inference not available
```bash
# Verify inference script exists
ls -la ~/.claude/tools/Inference.ts
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (missing args, API failure, etc.) |
