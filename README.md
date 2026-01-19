# Curu Skills

Custom Claude Code skills for communications, productivity, and work integrations.

## Overview

This repository contains self-contained skills that extend Claude Code with external service integrations. Each skill follows PAI (Personal AI Infrastructure) structure with SKILL.md documentation, TypeScript CLI tools, and markdown workflows.

**Repository:** `github.com/sethdf/curu-skills`
**Location:** `~/.claude/skills/` (symlinked from this repo)
**Runtime:** Bun (TypeScript)

## Skills

| Skill | Invoke | Purpose | Zone-Aware |
|-------|--------|---------|------------|
| [Calendar](#calendar) | `/calendar` | Calendar management (MS365 or Google) | Yes |
| [Mail](#mail) | `/mail` | Email management (MS365 or Gmail) | Yes |
| [SDP](#sdp) | `/sdp` | ServiceDesk Plus ticket management | No (work only) |
| [Slack](#slack) | `/slack` | Slack workspace messaging | No |
| [Telegram](#telegram) | `/telegram` | Telegram personal messaging | No |
| [Signal](#signal) | `/signal` | Signal secure messaging | No |
| [YouTubeWisdom](#youtubewisdom) | `/yt-wisdom` | Extract insights from YouTube videos | No |
| [MailReview](#mailreview) | - | AI email triage review | No |
| [ContextPatterns](#contextpatterns) | - | Context-aware skill patterns | Reference |

## Installation

```bash
# Clone to your preferred location
git clone git@github.com:sethdf/curu-skills.git ~/repos/github.com/sethdf/curu-skills

# Symlink each skill into Claude's skills directory
for skill in Calendar Mail SDP Slack Telegram Signal YouTubeWisdom MailReview ContextPatterns; do
  ln -sf ~/repos/github.com/sethdf/curu-skills/$skill ~/.claude/skills/$skill
done
```

## Zone-Aware Routing

Several skills use `$ZONE` environment variable (set by direnv) to route to the appropriate backend:

| Zone | Calendar | Mail |
|------|----------|------|
| `work` | MS365 (Graph API) | Outlook (Graph API) |
| `home` | Google Calendar | Gmail |

Zone is automatically set when you `cd` into `/data/work/` or `/data/home/` directories.

---

## Calendar

**Invoke:** `/calendar`
**Purpose:** Zone-aware calendar management

### Commands

| Command | Description |
|---------|-------------|
| `today` | Show today's events |
| `tomorrow` | Show tomorrow's events |
| `week` | Show this week's events |
| `search <query>` | Search events |
| `create <title> <time>` | Create event |

### Backend Routing

- `$ZONE=work` → MS365 via `auth-keeper ms365`
- `$ZONE=home` → Google Calendar via `auth-keeper google calendar`

---

## Mail

**Invoke:** `/mail`
**Purpose:** Zone-aware email management

### Commands

| Command | Description |
|---------|-------------|
| (default) | Show recent inbox |
| `unread` | Show unread messages |
| `search <query>` | Search emails |
| `send <to> <subject> <body>` | Send email |

### Backend Routing

- `$ZONE=work` → MS365 Outlook via `auth-keeper ms365`
- `$ZONE=home` → Gmail via `auth-keeper google mail`

---

## SDP

**Invoke:** `/sdp`
**Purpose:** ServiceDesk Plus ticket management

### Commands

| Command | Description |
|---------|-------------|
| (default) | Show my assigned tickets |
| `overdue` | List overdue tickets |
| `suggest` | Recommend next ticket to work on |
| `note <id> <text>` | Add internal note to ticket |
| `reply <id> <text>` | Send reply to requester |

### Configuration

- **Default technician:** `sfoley@buxtonco.com`
- **API key:** BWS `sdp-api-key`
- **Base URL:** BWS `sdp-base-url`

---

## Slack

**Invoke:** `/slack`
**Purpose:** Slack workspace messaging

### Commands

| Command | Description |
|---------|-------------|
| `channels` | List channels |
| `read <channel> [n]` | Read last n messages |
| `send <channel> <msg>` | Send to channel |
| `dm <user> <msg>` | Direct message |

### Authentication

Uses `auth-keeper slack`. Token stored in BWS as `slack-bot-token`.

---

## Telegram

**Invoke:** `/telegram`
**Purpose:** Telegram Bot API for personal messaging

### Commands

| Command | Description |
|---------|-------------|
| `updates` | Get recent messages |
| `send <chat_id> <msg>` | Send message |
| `photo <chat_id> <path>` | Send photo |

### Authentication

Uses `auth-keeper telegram`. Bot token in BWS as `telegram-bot-token`.

---

## Signal

**Invoke:** `/signal`
**Purpose:** Signal secure messaging via signal-cli

### Commands

| Command | Description |
|---------|-------------|
| (default) | Show recent messages |
| `send <number> <msg>` | Send message |
| `receive` | Receive pending messages |

### Authentication

Uses `signal-cli` with linked device. See `signal-interface.sh`.

---

## YouTubeWisdom

**Invoke:** `/yt-wisdom`
**Purpose:** Extract insights from YouTube videos using Apify + fabric

### Features

- Transcribe YouTube videos
- Extract key insights and wisdom
- Save to MEMORY for later reference

---

## MailReview

**Purpose:** AI-assisted email triage review

Not directly invocable. Integrates with external mail processing project.

---

## ContextPatterns

**Purpose:** Reference patterns for building context-aware skills

Not directly invocable. Used by CreateSkill for adding zone awareness to skills.

### Context Detection Methods

1. **Environment Variables** - Check `$ZONE` (set by direnv)
2. **Directory Detection** - Check current working directory
3. **SessionStart Hooks** - Auto-inject context
4. **Marker Files** - `.ticket.json`, `.project.json`

---

## Packs

Skills are organized into packs for easier installation:

| Pack | Skills | Purpose |
|------|--------|---------|
| `comms-pack` | Calendar, Mail, Slack, Telegram, Signal | Communications |
| `auth-pack` | auth-keeper, asudo, bws-init | Authentication |

See `packs/` directory for installation instructions.

---

## Creating New Skills

Use the PAI CreateSkill framework:

```
/CreateSkill
```

For context-aware skills, reference `ContextPatterns/SKILL.md`.

---

## License

Private repository for personal use.
