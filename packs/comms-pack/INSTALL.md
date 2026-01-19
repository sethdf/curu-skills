# Communications Pack Installation

## Prerequisites

- [ ] PAI core installed (`~/.claude/` directory exists)
- [ ] auth-pack installed (for token management)
- [ ] MS365 OAuth configured (for work calendar/mail)
- [ ] Google OAuth configured (for home calendar/mail)
- [ ] Slack app configured (for Slack integration)
- [ ] Telegram bot configured (for Telegram integration)
- [ ] signal-cli installed and linked (for Signal integration)

## Installation Steps

### Step 1: Symlink skills from curu-skills

This pack references skills in the parent curu-skills repository. The recommended installation is to symlink the entire curu-skills directory:

```bash
# If not already done, symlink all skills
ln -sf /path/to/curu-skills ~/.claude/skills
```

Or symlink individual comms skills:

```bash
CURU_SKILLS="/path/to/curu-skills"  # Adjust to your path
ln -sf "$CURU_SKILLS/Calendar" ~/.claude/skills/
ln -sf "$CURU_SKILLS/Mail" ~/.claude/skills/
ln -sf "$CURU_SKILLS/Slack" ~/.claude/skills/
ln -sf "$CURU_SKILLS/Telegram" ~/.claude/skills/
ln -sf "$CURU_SKILLS/Signal" ~/.claude/skills/
ln -sf "$CURU_SKILLS/Comms" ~/.claude/skills/
```

### Step 2: Copy scripts to bin

```bash
mkdir -p ~/bin
PACK_DIR="$(dirname "$(realpath "$0")")"
cp "$PACK_DIR/src/scripts/signal-inbox.sh" ~/bin/
cp "$PACK_DIR/src/scripts/signal-interface.sh" ~/bin/
cp "$PACK_DIR/src/scripts/telegram-inbox.sh" ~/bin/
chmod +x ~/bin/signal-*.sh ~/bin/telegram-*.sh
```

### Step 3: Configure environment variables (optional)

Add to `~/.claude/settings.json` env section or `~/.bashrc`:

```bash
export ZONE="work"  # Default zone
export TELEGRAM_CHAT_ID="your-default-chat-id"
export SIGNAL_RECIPIENT="+1234567890"
```

### Step 4: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Skills Included

This pack provides the following skills (located in `../../` relative to this pack):

| Skill | Location | Purpose |
|-------|----------|---------|
| Calendar | `../../Calendar/` | Calendar management (MS365/Google) |
| Mail | `../../Mail/` | Email management (MS365/Gmail) |
| Slack | `../../Slack/` | Slack messaging |
| Telegram | `../../Telegram/` | Telegram messaging |
| Signal | `../../Signal/` | Signal messaging |
| Comms | `../../Comms/` | Unified communications triage |

## Service-Specific Setup

### MS365 (Work Calendar/Mail)

1. Register app in Azure AD
2. Configure redirect URI
3. Grant Calendar.ReadWrite, Mail.ReadWrite permissions
4. Store client ID/secret in auth-keeper

### Google (Home Calendar/Mail)

1. Create project in Google Cloud Console
2. Enable Calendar API, Gmail API
3. Create OAuth credentials
4. Store client ID/secret in auth-keeper

### Slack

1. Create Slack app at api.slack.com
2. Add required scopes: chat:write, channels:read, users:read
3. Install to workspace
4. Store bot token via auth-keeper

### Telegram

1. Create bot via @BotFather
2. Get bot token
3. Store in BWS as `telegram-bot-token`

### Signal

```bash
# Link device
signal-cli link -n "imladris"
# Scan QR code with Signal app
```

## Uninstallation

```bash
# Remove symlinks (not the source skills)
rm ~/.claude/skills/Calendar
rm ~/.claude/skills/Mail
rm ~/.claude/skills/Slack
rm ~/.claude/skills/Telegram
rm ~/.claude/skills/Signal
rm ~/.claude/skills/Comms

# Remove scripts
rm ~/bin/signal-*.sh ~/bin/telegram-*.sh
```
