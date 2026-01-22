# Cron Setup Workflow

Configure automated syncing for the unified inbox.

## Recommended Schedule

| Source | Frequency | Rationale |
|--------|-----------|-----------|
| email-ms365 | Every 5 min | Real-time email is important |
| email-gmail | Every 5 min | Real-time email is important |
| slack | Every 15 min | slackdump archives hourly |
| telegram | Every 5 min | Bot API is rate-limited |
| sdp-ticket | Every 10 min | Tickets don't change frequently |
| sdp-task | Every 10 min | Tasks don't change frequently |

## Setup

### 1. Create Cron File

```bash
sudo tee /etc/cron.d/unified-inbox << 'EOF'
# UnifiedInbox sync jobs
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

# Email sources - every 5 minutes
*/5 * * * * ubuntu cd /home/ubuntu/repos/github.com/sethdf/curu-skills && bun Inbox/UnifiedInbox/Tools/inbox.ts sync --source email-ms365,email-gmail --quiet >> /var/log/unified-inbox.log 2>&1

# Telegram - every 5 minutes (offset by 2)
2-57/5 * * * * ubuntu cd /home/ubuntu/repos/github.com/sethdf/curu-skills && bun Inbox/UnifiedInbox/Tools/inbox.ts sync --source telegram --quiet >> /var/log/unified-inbox.log 2>&1

# SDP - every 10 minutes
*/10 * * * * ubuntu cd /home/ubuntu/repos/github.com/sethdf/curu-skills && bun Inbox/UnifiedInbox/Tools/inbox.ts sync --source sdp-ticket,sdp-task --quiet >> /var/log/unified-inbox.log 2>&1

# Slack - every 15 minutes (depends on slackdump)
*/15 * * * * ubuntu cd /home/ubuntu/repos/github.com/sethdf/curu-skills && bun Inbox/UnifiedInbox/Tools/inbox.ts sync --source slack --quiet >> /var/log/unified-inbox.log 2>&1
EOF
```

### 2. Create Log File

```bash
sudo touch /var/log/unified-inbox.log
sudo chown ubuntu:ubuntu /var/log/unified-inbox.log
```

### 3. Verify Cron

```bash
# Check cron status
sudo systemctl status cron

# View cron log
tail -f /var/log/unified-inbox.log
```

## Log Rotation

```bash
sudo tee /etc/logrotate.d/unified-inbox << 'EOF'
/var/log/unified-inbox.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
}
EOF
```

## Monitoring

Check sync status anytime:

```bash
inbox stats --json | jq '.syncStates'
```

Watch for issues:

```bash
# Recent errors
grep -i error /var/log/unified-inbox.log | tail -20

# Sources in backoff
inbox stats | grep -A1 "Backoff"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Source stuck in backoff | Wait for backoff to expire, or manually reset |
| Auth failures | Check `auth-keeper status` |
| Database locked | Only one sync should run at a time |
| slackdump not updating | Check `/etc/cron.d/slackdump` |

### Reset Sync State

If a source is stuck, manually reset:

```bash
sqlite3 /data/.cache/unified-inbox/inbox.sqlite \
  "UPDATE sync_state SET backoff_until = NULL, consecutive_failures = 0, status = 'success' WHERE source = 'email-ms365';"
```
