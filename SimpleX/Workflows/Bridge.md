# Bridge Workflow

Start the SimpleX-to-PAI bridge for mobile communication.

## Overview

The bridge enables:
1. Send message from phone (SimpleX iOS app)
2. Bridge receives and routes through Haiku for context
3. Claude Code executes the request
4. Response sent back through SimpleX

## Prerequisites

- `simplex-bridge.sh` from `simplex-bridge-pack`
- SimpleX CLI configured with mobile contact
- Claude Code CLI available

## Step 1: Verify Bridge Installation

```bash
ls -la ~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/scripts/simplex-bridge.sh
```

## Step 2: Check Dependencies

```bash
~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/scripts/simplex-bridge.sh status
```

Verifies:
- simplex-chat CLI
- claude CLI
- jq

## Step 3: Start Bridge

### Foreground (for testing)

```bash
~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/scripts/simplex-bridge.sh listen
```

### Background (daemon mode)

```bash
nohup ~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/scripts/simplex-bridge.sh listen &
```

### Systemd (recommended for production)

```bash
sudo cp ~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/systemd/simplex-bridge.service /etc/systemd/system/
sudo systemctl enable simplex-bridge
sudo systemctl start simplex-bridge
```

## Step 4: Test Routing

Test without sending:

```bash
~/repos/github.com/sethdf/curu-skills/packs/simplex-bridge-pack/src/scripts/simplex-bridge.sh test "What's on my calendar today?"
```

Expected output:
```json
{
  "context": "work",
  "skill": "calendar",
  "project": "none"
}
```

## Configuration

Edit `~/.config/simplex-bridge/config.yaml`:

```yaml
contexts:
  work:
    roots:
      - ~/repos/work/
    calendar: ms365
    mail: ms365
    hours:
      start: 9
      end: 18
      days: [Mon, Tue, Wed, Thu, Fri]

  home:
    roots:
      - ~/repos/personal/
    calendar: google
    mail: gmail

skills:
  calendar:
    triggers: [/calendar, "calendar", "schedule", "meeting"]
  mail:
    triggers: [/mail, "email", "inbox"]
  slack:
    triggers: [/slack, "slack", "channel"]
```

## Step 5: Monitor Bridge

Logs are written to `~/inbox/simplex/`:

```bash
tail -f ~/inbox/simplex/$(date +%Y-%m-%d).md
```

## Mobile Usage

From SimpleX iOS app:

1. Open conversation with PAI Bridge contact
2. Send natural language request:
   - "Check my calendar"
   - "/slack unread"
   - "What tickets are assigned to me?"
3. Bridge routes to Claude Code
4. Response appears in chat

## Stop Bridge

```bash
# If running in foreground
Ctrl+C

# If running as systemd service
sudo systemctl stop simplex-bridge

# If running in background
pkill -f simplex-bridge.sh
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bridge not receiving | Check simplex-chat is configured |
| Wrong context detected | Adjust config.yaml rules |
| Timeout on response | Increase response.timeout in config |
| Claude not executing | Check claude CLI is in PATH |
