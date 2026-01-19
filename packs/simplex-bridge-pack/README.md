---
name: SimpleX Bridge Pack
pack-id: sethdf-simplex-bridge-pack-v1.0.0
version: 1.0.0
author: sethdf
description: Mobile AI interface via SimpleX Chat - receive messages from phone, route through Haiku, execute via Claude Code, respond via SimpleX
type: integration
purpose-type: [mobile, interface, automation]
platform: claude-code
dependencies: [pai-core-install, auth-pack, comms-pack, simplex-chat]
keywords: [simplex, mobile, chat, routing, ai-interface]
---

# SimpleX Bridge Pack (simplex-bridge-pack)

> Mobile AI interface via SimpleX Chat - interact with Claude Code from your phone

> **Installation:** This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using the wizard in `INSTALL.md`.

---

## What's Included

| Component | Purpose |
|-----------|---------|
| simplex-bridge.sh | Main listener and router script |
| simplex-bridge.yaml | Context routing configuration |
| simplex-bridge.service | Systemd unit for persistence |

**Summary:**
- **Scripts:** 1
- **Config files:** 1
- **Systemd units:** 1
- **Dependencies:** simplex-chat CLI, claude CLI

## The Problem

You want to interact with your AI assistant from your phone:
- No native Claude mobile app with full capabilities
- Can't run Claude Code on mobile
- Want to send quick queries while away from computer
- Need context-aware routing (work vs home)

## The Solution

SimpleX Bridge provides:

1. **Mobile Interface**: Send messages from SimpleX Chat app on phone
2. **Smart Routing**: Haiku analyzes messages and routes to appropriate context
3. **Full Execution**: Claude Code executes with full skill access
4. **Response Delivery**: Results sent back to phone via SimpleX
5. **Conversation Logging**: All interactions logged for reference

## Architecture

```
Phone (SimpleX App)
       |
       v
SimpleX Server (decentralized, E2E encrypted)
       |
       v
Imladris (simplex-chat CLI)
       |
       v
┌─────────────────────────┐
│    simplex-bridge.sh    │
│                         │
│  1. Receive message     │
│  2. Detect context      │  <-- Haiku (fast)
│  3. Route to skill      │
│  4. Execute request     │  <-- Opus (powerful)
│  5. Send response       │
│  6. Log conversation    │
└─────────────────────────┘
       |
       v
Response via SimpleX
```

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Verification

See [VERIFY.md](VERIFY.md) for testing and verification procedures.

## Usage

### Start the bridge

```bash
# Interactive mode
simplex-bridge.sh listen

# Or via systemd
sudo systemctl start simplex-bridge
```

### Check status

```bash
simplex-bridge.sh status
```

### Test routing

```bash
simplex-bridge.sh test "What's on my calendar today?"
simplex-bridge.sh test "/slack check #general"
```

## Context Routing

The bridge uses Haiku to analyze each message and determine:

### Context Detection

| Signal | Context |
|--------|---------|
| Work hours (Mon-Fri 9-6) | work |
| Weekends/evenings | home |
| Professional keywords | work |
| Personal/casual tone | home |

### Skill Detection

| Trigger | Skill |
|---------|-------|
| `/calendar`, "schedule", "meeting" | Calendar |
| `/mail`, "email", "inbox" | Mail |
| `/slack`, "channel" | Slack |
| `/telegram` | Telegram |
| `/signal` | Signal |
| `/comms`, "triage" | Comms |

### Project Detection

Messages mentioning project names are routed to the appropriate project directory for full context.

## Configuration

### Config file: `~/.config/simplex-bridge/config.yaml`

```yaml
contexts:
  work:
    roots:
      - ~/repos/work/
    calendar: ms365
    mail: ms365
  home:
    roots:
      - ~/repos/personal/
    calendar: google
    mail: gmail

logging:
  directory: ~/inbox/simplex
  format: markdown
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SIMPLEX_CLI` | `~/.local/bin/simplex-chat` | SimpleX CLI path |
| `SIMPLEX_BRIDGE_CONFIG` | `~/.config/simplex-bridge/config.yaml` | Config file path |
| `SIMPLEX_BRIDGE_LOG_DIR` | `~/inbox/simplex` | Log directory |
| `CLAUDE_CMD` | `claude` | Claude CLI command |

## Conversation Logs

All conversations are logged to `~/inbox/simplex/YYYY-MM-DD.md`:

```markdown
## 2026-01-19 14:30:22

**From:** phone
**Context:** work

**Message:**
What's on my calendar for this afternoon?

**Response:**
You have 2 meetings this afternoon:
- 2:00 PM: Team standup (30 min)
- 4:00 PM: Project review (1 hour)

---
```

## Security

- **E2E Encrypted**: SimpleX provides end-to-end encryption
- **No Phone Number**: SimpleX doesn't require phone number
- **Local Processing**: All AI processing on your server
- **No Data Sharing**: Messages stay between your devices

## Credits

- **Author**: Seth (sethdf)
- **Framework**: PAI (Personal AI Infrastructure)
- **Messaging**: SimpleX Chat

## Changelog

### 1.0.0 - 2026-01-19
- Initial release
- Basic listener and router
- Context detection via Haiku
- Conversation logging
- Systemd service
