# Auth Pack Installation

## Prerequisites

- [ ] PAI core installed (`~/.claude/` directory exists)
- [ ] Bitwarden Secrets Manager CLI (`bws`) installed
- [ ] AWS CLI v2 installed
- [ ] Azure CLI installed
- [ ] signal-cli installed (for Signal integration)
- [ ] LUKS-encrypted volume mounted at /data (for imladris)

## Installation Steps

### Step 1: Create bin directory (if not exists)

```bash
mkdir -p ~/bin
```

### Step 2: Copy scripts

```bash
cp src/scripts/auth-keeper.sh ~/bin/
cp src/scripts/asudo.sh ~/bin/
cp src/scripts/bws-init.sh ~/bin/
cp src/scripts/claude-backend.sh ~/bin/
```

### Step 3: Make scripts executable

```bash
chmod +x ~/bin/auth-keeper.sh ~/bin/asudo.sh ~/bin/bws-init.sh ~/bin/claude-backend.sh
```

### Step 4: Create symlinks (optional)

```bash
ln -sf ~/bin/auth-keeper.sh ~/bin/auth-keeper
ln -sf ~/bin/asudo.sh ~/bin/asudo
ln -sf ~/bin/claude-backend.sh ~/bin/claude-backend
```

### Step 5: Initialize BWS

```bash
# Get BWS access token from Bitwarden vault
export BWS_ACCESS_TOKEN="<your-token>"

# Initialize BWS
bws-init.sh
```

### Step 6: Configure services

#### AWS (IAM Identity Center)

```bash
aws configure sso
# Follow prompts to configure SSO
```

#### Azure

```bash
az login --use-device-code
```

#### MS365 / Google / Slack

OAuth tokens should be configured via the respective service setup flows.
Tokens are stored in `~/.claude/.credentials.json`.

#### Telegram

Bot token stored in BWS under `telegram-bot-token`.

#### Signal

```bash
signal-cli link -n "imladris"
# Scan QR code with Signal app
```

### Step 7: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Alternative: Symlink Installation

If maintaining scripts in the imladris repository:

```bash
ln -sf ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh ~/bin/auth-keeper
ln -sf ~/repos/github.com/sethdf/imladris/scripts/asudo.sh ~/bin/asudo
ln -sf ~/repos/github.com/sethdf/imladris/scripts/bws-init.sh ~/bin/bws-init
ln -sf ~/repos/github.com/sethdf/imladris/scripts/claude-backend.sh ~/bin/claude-backend
```

## Uninstallation

```bash
rm ~/bin/auth-keeper.sh ~/bin/auth-keeper
rm ~/bin/asudo.sh ~/bin/asudo
rm ~/bin/bws-init.sh ~/bin/bws-init
rm ~/bin/claude-backend.sh ~/bin/claude-backend
```

Note: This does not remove credentials or service configurations.
