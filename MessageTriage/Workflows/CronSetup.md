# CronSetup Workflow

**Configure scheduled automated message triage via cron or systemd timer.**

## Prerequisites

- `bun` installed and in PATH
- `auth-keeper` configured for MS365
- PAI Inference tool available at `~/.claude/tools/Inference.ts`
- Write access to `/etc/cron.d/` or systemd user timers

## Step 1: Verify Tool Works

Before setting up cron, verify the tool runs successfully:

```bash
# Test run with verbose output
bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts \
  --source email \
  --limit 10 \
  --dry-run \
  --verbose
```

Expected output:
- `[OK] Exported N emails to cache`
- `[OK] Categorized N messages`
- Report with category distribution

## Step 2: Choose Schedule

| Schedule | Use Case | Cron Expression |
|----------|----------|-----------------|
| Every 4 hours | Standard triage | `0 */4 * * *` |
| Every 2 hours | Heavy email users | `0 */2 * * *` |
| Twice daily (9am, 2pm) | Workday focus | `0 9,14 * * 1-5` |
| Daily at 8am | Morning inbox review | `0 8 * * *` |
| Hourly | Real-time monitoring | `0 * * * *` |

## Step 3: Setup Cron

### Option A: User Crontab

```bash
# Edit user crontab
crontab -e

# Add line (every 4 hours with notification)
0 */4 * * * /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet 2>&1 | logger -t autotriage
```

### Option B: System Cron File

```bash
# Create cron file
sudo tee /etc/cron.d/autotriage << 'EOF'
# AutoTriage - Automated email categorization
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
HOME=/home/ubuntu

# Every 4 hours
0 */4 * * * ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet 2>&1 | logger -t autotriage

# Daily summary at 8am (more messages)
0 8 * * * ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --limit 200 --notify --quiet 2>&1 | logger -t autotriage
EOF

# Set permissions
sudo chmod 644 /etc/cron.d/autotriage
```

### Option C: Systemd Timer (Recommended)

Create service file:
```bash
sudo tee /etc/systemd/system/autotriage.service << 'EOF'
[Unit]
Description=AutoTriage Email Categorization
After=network.target

[Service]
Type=oneshot
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --notify --quiet
Environment=HOME=/home/ubuntu
Environment=PATH=/usr/local/bin:/usr/bin:/bin

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=autotriage
EOF
```

Create timer file:
```bash
sudo tee /etc/systemd/system/autotriage.timer << 'EOF'
[Unit]
Description=Run AutoTriage every 4 hours

[Timer]
OnCalendar=*-*-* 0/4:00:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable autotriage.timer
sudo systemctl start autotriage.timer

# Verify
systemctl status autotriage.timer
systemctl list-timers | grep autotriage
```

## Step 4: Verify Logging

### Check Cron Logs
```bash
# Syslog
grep autotriage /var/log/syslog | tail -20

# Journal (systemd)
journalctl -u autotriage -f
```

### Check Run History
```bash
sqlite3 ~/.cache/message-triage/messages.sqlite "
  SELECT id, source, started_at, messages_processed, status
  FROM triage_runs
  ORDER BY started_at DESC
  LIMIT 10;
"
```

## Step 5: Setup Notifications

AutoTriage can notify via the PAI voice server when runs complete.

### Verify Notification Endpoint
```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Test notification"}'
```

### Alternative: ntfy.sh
```bash
# Set environment variable
export NOTIFY_URL="https://ntfy.sh/your-topic"

# Or modify cron
0 */4 * * * NOTIFY_URL=https://ntfy.sh/your-topic /usr/bin/bun /path/to/AutoTriage.ts --source email --notify --quiet
```

## Step 6: Slack Integration (Optional)

Add Slack channel triage to the schedule:

```bash
# Add to crontab or cron.d file
# Daily Slack triage at 9am
0 9 * * 1-5 ubuntu /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source slack --channel support --notify --quiet 2>&1 | logger -t autotriage-slack
```

## Monitoring Dashboard

Query the cache database for monitoring:

```bash
# Create monitoring script
cat > ~/.local/bin/autotriage-status << 'EOF'
#!/bin/bash
echo "=== AutoTriage Status ==="
echo ""
echo "Recent Runs:"
sqlite3 -column -header ~/.cache/message-triage/messages.sqlite "
  SELECT
    substr(id, 1, 20) as run,
    source,
    strftime('%Y-%m-%d %H:%M', started_at) as started,
    messages_processed as msgs,
    categories_applied as cats,
    status
  FROM triage_runs
  ORDER BY started_at DESC
  LIMIT 5;
"
echo ""
echo "Category Distribution (Last 7 Days):"
sqlite3 -column -header ~/.cache/message-triage/messages.sqlite "
  SELECT category, COUNT(*) as count
  FROM messages
  WHERE exported_at > datetime('now', '-7 days')
  GROUP BY category
  ORDER BY count DESC;
"
echo ""
echo "Action Required:"
sqlite3 ~/.cache/message-triage/messages.sqlite "
  SELECT COUNT(*) || ' messages need attention'
  FROM messages
  WHERE category = 'Action-Required'
    AND exported_at > datetime('now', '-24 hours');
"
EOF
chmod +x ~/.local/bin/autotriage-status
```

Run with: `autotriage-status`

## Troubleshooting

### Cron Not Running
```bash
# Check cron service
systemctl status cron

# Check cron syntax
crontab -l

# Test manually
/usr/bin/bun /path/to/AutoTriage.ts --source email --verbose
```

### Auth Issues in Cron
```bash
# Cron runs without interactive shell context
# Ensure auth-keeper works non-interactively
zsh -ic 'auth-keeper status'

# May need to refresh token manually before cron runs
auth-keeper ms365 --auth
```

### Missing Dependencies
```bash
# Check bun
which bun
bun --version

# Check sqlite3
which sqlite3
sqlite3 --version
```

## Output

On successful setup, report:
- Cron entry or systemd timer configured
- First scheduled run time
- How to check logs
- How to view run history
