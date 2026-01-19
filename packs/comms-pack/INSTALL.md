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

### Step 1: Create skills directory (if not exists)

```bash
mkdir -p ~/.claude/skills
```

### Step 2: Copy skills

```bash
cp -r src/skills/Calendar ~/.claude/skills/
cp -r src/skills/Mail ~/.claude/skills/
cp -r src/skills/Slack ~/.claude/skills/
cp -r src/skills/Telegram ~/.claude/skills/
cp -r src/skills/Signal ~/.claude/skills/
cp -r src/skills/Comms ~/.claude/skills/
```

### Step 3: Copy scripts to bin

```bash
mkdir -p ~/bin
cp src/scripts/signal-inbox.sh ~/bin/
cp src/scripts/signal-interface.sh ~/bin/
cp src/scripts/telegram-inbox.sh ~/bin/
chmod +x ~/bin/signal-*.sh ~/bin/telegram-*.sh
```

### Step 4: Configure environment variables (optional)

Add to `~/.claude/settings.json` env section or `~/.bashrc`:

```bash
export PAI_CONTEXT="work"  # Default context
export TELEGRAM_CHAT_ID="your-default-chat-id"
export SIGNAL_RECIPIENT="+1234567890"
```

### Step 5: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Alternative: Symlink Installation

If maintaining skills in the curu-skills repository:

```bash
# Link entire skills directory
ln -sf ~/repos/github.com/sethdf/curu-skills/Calendar ~/.claude/skills/Calendar
ln -sf ~/repos/github.com/sethdf/curu-skills/Mail ~/.claude/skills/Mail
ln -sf ~/repos/github.com/sethdf/curu-skills/Slack ~/.claude/skills/Slack
ln -sf ~/repos/github.com/sethdf/curu-skills/Telegram ~/.claude/skills/Telegram
ln -sf ~/repos/github.com/sethdf/curu-skills/Signal ~/.claude/skills/Signal
ln -sf ~/repos/github.com/sethdf/curu-skills/Comms ~/.claude/skills/Comms
```

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
rm -rf ~/.claude/skills/Calendar
rm -rf ~/.claude/skills/Mail
rm -rf ~/.claude/skills/Slack
rm -rf ~/.claude/skills/Telegram
rm -rf ~/.claude/skills/Signal
rm -rf ~/.claude/skills/Comms
rm ~/bin/signal-*.sh ~/bin/telegram-*.sh
```
