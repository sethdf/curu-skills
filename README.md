# Claude Skills

Custom skills for Claude Code - email, calendar, and messaging integrations.

## Skills

| Skill | Invoke | Purpose |
|-------|--------|---------|
| Gmail | `/gmail` | Gmail email via API |
| Outlook | `/outlook` | M365 email via Graph API |
| GoogleCalendar | `/gcal` | Google Calendar |
| OutlookCalendar | `/ocal` | M365 Calendar + Teams |
| Slack | `/slack` | Slack workspace messaging |
| Telegram | `/telegram` | Telegram personal messaging |

## Installation

```bash
# Clone
git clone git@github.com:USERNAME/claude-skills.git ~/current/claude-skills

# Symlink each skill into ~/.claude/skills/
for skill in Gmail Outlook GoogleCalendar OutlookCalendar Slack Telegram; do
  ln -sf ~/current/claude-skills/$skill ~/.claude/skills/$skill
done

# Regenerate skill index
cd ~/.claude && bun run Tools/GenerateSkillIndex.ts
```

## Authentication Setup

### Google (Gmail + Calendar)
```bash
# OAuth via Google Cloud Console
# Credentials: ~/.config/gmail-cli/credentials.json
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts auth
```

### Microsoft (Outlook + Calendar)
```bash
# OAuth via Azure AD app registration
# Set: MS_CLIENT_ID, MS_TENANT_ID
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts auth
```

### Slack
```bash
# Bot token from api.slack.com/apps
export SLACK_BOT_TOKEN="xoxb-..."
bun run ~/.claude/skills/Slack/Tools/SlackClient.ts auth
```

### Telegram
```bash
# Bot token from @BotFather
export TELEGRAM_BOT_TOKEN="123456:ABC..."
bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts auth
```

## Creating New Skills

Use the PAI CreateSkill framework:
```
/CreateSkill
```
