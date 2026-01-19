---
name: Communications Pack
pack-id: sethdf-comms-pack-v1.0.0
version: 1.0.0
author: sethdf
description: Unified communications skills for Claude Code - Calendar, Mail, Slack, Telegram, Signal with context-aware routing (work vs home)
type: communications
purpose-type: [communications, productivity, integration]
platform: claude-code
dependencies: [pai-core-install, auth-pack]
keywords: [calendar, mail, email, slack, telegram, signal, communications, messaging]
---

# Communications Pack (comms-pack)

> Unified communications integration for Claude Code

> **Installation:** This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using the wizard in `INSTALL.md`.

---

## What's Included

| Component | Count | Purpose |
|-----------|-------|---------|
| Skills | 6 | Calendar, Mail, Slack, Telegram, Signal, Comms |
| Scripts | 3 | Signal interface, inbox helpers |

**Summary:**
- **Skills registered:** 6
- **Scripts:** 3
- **Dependencies:** auth-pack (for token management)

## The Problem

Communications are fragmented across multiple platforms:
- Work calendar on MS365, personal on Google
- Work email on Outlook, personal on Gmail
- Team chat on Slack
- Personal messaging on Telegram and Signal
- No unified interface

## The Solution

Comms Pack provides:

1. **Context-Aware Routing**: Work context → MS365, Home context → Google
2. **Unified Skills**: Single `/calendar`, `/mail` commands that route correctly
3. **Multi-Platform Messaging**: Slack, Telegram, Signal from Claude Code
4. **Aggregated Inbox**: `/comms` for unified inbox triage

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Verification

See [VERIFY.md](VERIFY.md) for testing and verification procedures.

## Skills Reference

### Calendar (`/calendar`)

```
/calendar                 # Today's events
/calendar tomorrow        # Tomorrow's events
/calendar week           # This week's events
/calendar search "meeting" # Search events
/calendar create "Title" 2pm-3pm  # Create event
```

**Context routing:**
- `work` → MS365 Calendar (Graph API)
- `home` → Google Calendar

### Mail (`/mail`)

```
/mail                    # Recent inbox
/mail unread             # Unread messages
/mail search "subject"   # Search emails
/mail send to@email.com "Subject" "Body"  # Send email
```

**Context routing:**
- `work` → MS365 Outlook (Graph API)
- `home` → Gmail

### Slack (`/slack`)

```
/slack                   # Recent messages
/slack #channel          # Channel messages
/slack send #channel "message"  # Send message
/slack dm @user "message"       # Direct message
```

### Telegram (`/telegram`)

```
/telegram                # Recent messages
/telegram send "message" # Send to default chat
/telegram send @user "message"  # Send to user
```

### Signal (`/signal`)

```
/signal                  # Recent messages
/signal send "message"   # Send to default contact
/signal send +1234567890 "message"  # Send to number
```

### Comms (`/comms`)

Unified inbox aggregation:

```
/comms                   # Check all platforms
/comms triage            # AI-assisted triage
/comms priority          # High priority items only
```

## Context Detection

Context is determined by:

1. **Explicit flag**: `--context work` or `--context home`
2. **Environment variable**: `$PAI_CONTEXT`
3. **Time-based inference**: Work hours → work, evenings/weekends → home
4. **Working directory**: Repos under work/ → work context

## Architecture

```
+-----------------+
|   /calendar     |  <-- User command
+-----------------+
        |
        v
+-----------------+
| Context Router  |  <-- Determines work vs home
+-----------------+
        |
   work │ home
        v
+-------+-------+
|MS365  |Google |  <-- Platform-specific API
+-------+-------+
```

## Configuration

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `PAI_CONTEXT` | Force context (work/home) |
| `WORK_CALENDAR_ID` | MS365 calendar ID |
| `HOME_CALENDAR_ID` | Google calendar ID |
| `SLACK_WORKSPACE` | Default Slack workspace |
| `TELEGRAM_CHAT_ID` | Default Telegram chat |
| `SIGNAL_RECIPIENT` | Default Signal contact |

## Credits

- **Author**: Seth (sethdf)
- **Framework**: PAI (Personal AI Infrastructure)
- **Integrations**: Microsoft Graph, Google APIs, Slack, Telegram, Signal

## Changelog

### 1.0.0 - 2026-01-19
- Initial release
- Extracted from curu-skills repository
- PAI-compliant pack structure
- 6 communication skills
- Context-aware routing
