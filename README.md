# Curu Skills

Custom Claude Code skills for email, calendar, messaging, and productivity integrations.

## Overview

This repository contains self-contained skills that extend Claude Code with external service integrations. Each skill follows a consistent structure with SKILL.md documentation, TypeScript CLI tools, and markdown workflows.

**Repository:** `github.com/sethdf/curu-skills`
**Location:** `~/.claude/skills/` (symlinked from this repo)
**Runtime:** Bun (TypeScript)

## Skills

| Skill | Invoke | Purpose | Auth |
|-------|--------|---------|------|
| [Gmail](#gmail) | `/gmail` | Gmail email via API | OAuth 2.0 (Google) |
| [Outlook](#outlook) | `/outlook` | M365 email via Graph API | OAuth 2.0 (Azure AD) |
| [GoogleCalendar](#googlecalendar) | `/gcal` | Google Calendar management | Shared with Gmail |
| [OutlookCalendar](#outlookcalendar) | `/ocal` | M365 Calendar + Teams | Shared with Outlook |
| [Slack](#slack) | `/slack` | Slack workspace messaging | Bot token |
| [Telegram](#telegram) | `/telegram` | Telegram personal messaging | Bot token |
| [MailReview](#mailreview) | - | AI email triage review | External project |
| [ContextPatterns](#contextpatterns) | - | Context-aware skill patterns | Reference only |

## Installation

```bash
# Clone to your preferred location
git clone git@github.com:sethdf/curu-skills.git ~/current/claude-skills

# Symlink each skill into Claude's skills directory
for skill in Gmail Outlook GoogleCalendar OutlookCalendar Slack Telegram MailReview ContextPatterns; do
  ln -sf ~/current/claude-skills/$skill ~/.claude/skills/$skill
done
```

## Skill Structure

Each skill follows this structure:

```
SkillName/
├── SKILL.md              # Main documentation (required)
├── Tools/                # TypeScript CLI tools
│   └── ClientName.ts     # Bun-based client
└── Workflows/            # Step-by-step workflows
    ├── Setup.md          # Initial configuration
    └── *.md              # Other workflows
```

---

## Gmail

**Invoke:** `/gmail`
**Purpose:** Full Gmail API integration for email management

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Authenticate via OAuth (opens browser) |
| `unread [count]` | List unread messages |
| `search <query>` | Search with Gmail query syntax |
| `read <id>` | Read full message content |
| `reply <id>` | Draft a reply |
| `send` | Compose and send message |
| `labels` | List all labels |
| `label <id> <label>` | Apply label to message |
| `archive <id>` | Archive message |
| `trash <id>` | Move to trash |

### Authentication

```bash
# 1. Create OAuth credentials in Google Cloud Console
# 2. Download credentials.json to ~/.config/gmail-cli/
# 3. Run auth command
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts auth
```

**Token Storage:** `~/.config/gmail-cli/`
**Scopes:** `gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.labels`

---

## Outlook

**Invoke:** `/outlook`
**Purpose:** Microsoft 365 email via Graph API

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Authenticate via device code flow |
| `unread [max]` | List unread messages |
| `search <query>` | Search with OData filter or KQL |
| `read <id>` | Read full message |
| `reply <id>` | Start reply (body from stdin) |
| `send <to> <subject>` | Send message (body from stdin) |
| `folders` | List mail folders |
| `move <id> <folder>` | Move to folder |
| `archive <id>` | Archive message |
| `delete <id>` | Move to deleted items |

### Authentication

```bash
# 1. Register app in Azure AD portal
# 2. Set environment variables or create credentials file
export MS_CLIENT_ID="your-client-id"
export MS_TENANT_ID="your-tenant-id"

# 3. Run auth command
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts auth
```

**Token Storage:** `~/.config/outlook-cli/`
**Permissions:** `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `User.Read`

---

## GoogleCalendar

**Invoke:** `/gcal`
**Purpose:** Google Calendar management with natural language date support

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Re-authenticate with calendar scopes |
| `today` | Show today's events |
| `week` | Show this week's events |
| `range <start> <end>` | Events in date range |
| `search <query>` | Search events by text |
| `free [days]` | Find free time slots |
| `create <title> <start> <duration> [location]` | Create event |
| `update <id> <field> <value>` | Update event |
| `delete <id>` | Delete event |
| `calendars` | List available calendars |

### Authentication

Shares OAuth with Gmail. After Gmail auth, add calendar scopes:

```bash
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts auth
```

**Additional Scopes:** `calendar.readonly`, `calendar.events`
**Config (optional):** `~/.config/gcal-cli/config.json`

---

## OutlookCalendar

**Invoke:** `/ocal`
**Purpose:** M365 Calendar with Teams meeting support

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Re-authenticate with calendar scopes |
| `today` / `week` | Show events |
| `range <start> <end>` | Events in date range |
| `search <query>` | Search by subject |
| `free [days]` | Find free slots |
| `availability <email> [days]` | Check someone's availability |
| `create <title> <start> <duration> [attendees]` | Create event |
| `teams <title> <start> <duration> [attendees]` | Create Teams meeting |
| `update <id> <field> <value>` | Update event |
| `delete <id>` | Delete/cancel event |
| `accept/decline/tentative <id>` | Respond to invites |
| `calendars` | List calendars |

### Authentication

Shares OAuth with Outlook email. After Outlook auth, add calendar scopes:

```bash
bun run ~/.claude/skills/OutlookCalendar/Tools/OCalClient.ts auth
```

**Additional Permissions:** `Calendars.Read`, `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite`
**Config (optional):** `~/.config/ocal-cli/config.json`

---

## Slack

**Invoke:** `/slack`
**Purpose:** Slack workspace integration

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Test authentication |
| `channels` | List channels |
| `read <channel> [n]` | Read last n messages |
| `send <channel> <msg>` | Send to channel |
| `dm <user> <msg>` | Direct message |
| `thread <channel> <ts> <msg>` | Reply in thread |
| `search <query>` | Search messages |
| `users` | List workspace users |
| `status [text] [emoji]` | Get/set status |
| `react <channel> <ts> <emoji>` | Add reaction |

### Authentication

```bash
# 1. Create Slack app at api.slack.com/apps
# 2. Add bot token scopes
# 3. Install to workspace
# 4. Set bot token
export SLACK_BOT_TOKEN="xoxb-..."
```

**Token Storage:** `~/.config/slack-cli/`
**Bot Scopes:** `channels:read`, `channels:history`, `chat:write`, `users:read`, `im:read`, `im:write`

---

## Telegram

**Invoke:** `/telegram`
**Purpose:** Telegram Bot API for personal messaging

### Commands

| Command | Description |
|---------|-------------|
| `auth` | Test bot token |
| `updates [count]` | Get recent messages to bot |
| `chats` | List known chats |
| `send <chat_id> <msg>` | Send message |
| `reply <chat_id> <msg_id> <text>` | Reply to message |
| `forward <from> <to> <msg_id>` | Forward message |
| `photo <chat_id> <path> [caption]` | Send photo |
| `file <chat_id> <path> [caption]` | Send file |
| `delete <chat_id> <msg_id>` | Delete message |
| `me` | Get bot info |

### Authentication

```bash
# 1. Create bot via @BotFather on Telegram
# 2. Set bot token
export TELEGRAM_BOT_TOKEN="123456:ABC..."

# 3. Optional: set default chat
export TELEGRAM_CHAT_ID="your-chat-id"
```

**Token Storage:** `~/.config/telegram-cli/`
**Chat Aliases:** `~/.config/telegram-cli/chats.json`

---

## MailReview

**Purpose:** AI-assisted email triage review for mail processing project

Not directly invocable. Integrates with external mail processor at `/home/sfoley/current/mail`.

### Workflows

- **Review** - Interactive approval/rejection of email classifications
- **Status** - Check mail processing system status

### Configuration

```bash
export HIMALAYA_BIN=~/.local/bin/himalaya
export MAIL_PROJECT=/home/sfoley/current/mail
```

---

## ContextPatterns

**Purpose:** Reference patterns for building context-aware skills

Not directly invocable. Used by `/CreateSkill` as a reference for adding context awareness to skills.

### Context Detection Methods

1. **Environment Variables** - Check `$CONTEXT` (set by direnv)
2. **Directory Detection** - Check current working directory patterns
3. **SessionStart Hooks** - Auto-inject context on Claude session start
4. **Marker Files** - Look for `.ticket.json`, `.project.json`, etc.

### Standard Context Variables

| Variable | Source | Values | Purpose |
|----------|--------|--------|---------|
| `CONTEXT` | `.envrc` | `work`, `home` | Primary context |
| `GHQ_ROOT` | `.envrc` | Path | Repository root |
| `SDP_TICKETS_DIR` | `.envrc` | Path | Ticket workspace |

See `ContextPatterns/SKILL.md` for full documentation and templates.

---

## Common Patterns

### Configuration Directory Structure

All skills use `~/.config/<service>-cli/`:

```
~/.config/gmail-cli/
├── credentials.json    # OAuth client config
└── token.json          # Access/refresh tokens

~/.config/outlook-cli/
├── credentials.json    # Azure AD app config
└── token.json          # Access/refresh tokens
```

### Environment Variable Precedence

1. Environment variables checked first
2. Falls back to config files if not set
3. Allows flexible deployment (dev vs prod)

### Running Tools Directly

```bash
# All tools are Bun TypeScript files
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts <command>
bun run ~/.claude/skills/Slack/Tools/SlackClient.ts <command>
```

---

## Creating New Skills

Use the PAI CreateSkill framework:

```
/CreateSkill
```

For context-aware skills, reference `ContextPatterns/SKILL.md`.

---

## Sync & Development

Skills are symlinked from this repo to `~/.claude/skills/`. Edits in either location affect the same files.

### Auto-sync to Git

Use `curu-watch` daemon to auto-commit/push changes:

```bash
curu-watch    # Run in tmux for background sync
```

### Manual Sync

```bash
curu-sync     # Copy ~/.claude/skills → repo
curu-commit   # Sync + commit with message
```

---

## License

Private repository for personal use.
