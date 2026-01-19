# SimpleX Bridge Pack Installation

## Prerequisites

- [ ] PAI core installed (`~/.claude/` directory exists)
- [ ] simplex-chat CLI installed (`~/.local/bin/simplex-chat`)
- [ ] Claude Code CLI available (`claude`)
- [ ] jq installed
- [ ] SimpleX Chat app on phone

## Installation Steps

### Step 1: Create directories

```bash
mkdir -p ~/bin
mkdir -p ~/.config/simplex-bridge
mkdir -p ~/inbox/simplex
```

### Step 2: Copy script

```bash
cp src/scripts/simplex-bridge.sh ~/bin/
chmod +x ~/bin/simplex-bridge.sh
```

### Step 3: Copy configuration

```bash
cp src/config/simplex-bridge.yaml ~/.config/simplex-bridge/config.yaml
```

### Step 4: Edit configuration

Edit `~/.config/simplex-bridge/config.yaml` to match your directory structure:

```bash
nano ~/.config/simplex-bridge/config.yaml
```

Update the `contexts.work.roots` and `contexts.home.roots` to match your actual directory structure.

### Step 5: Link SimpleX device (MANUAL STEP)

This step requires physical access to your phone:

1. Start simplex-chat on imladris:
   ```bash
   ~/.local/bin/simplex-chat
   ```

2. In the CLI, type `/connect` to generate a QR code or connection link

3. On your phone's SimpleX app:
   - Open Settings → Devices
   - Tap "Link a device"
   - Scan the QR code or paste the link

4. Verify connection by sending a test message

### Step 6: Install systemd service (optional)

For persistent operation:

```bash
sudo cp src/systemd/simplex-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable simplex-bridge
sudo systemctl start simplex-bridge
```

### Step 7: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Manual Testing

Before enabling the systemd service, test manually:

```bash
# Check status
simplex-bridge.sh status

# Test routing logic
simplex-bridge.sh test "What's on my calendar today?"
simplex-bridge.sh test "/slack check #general"

# Start listener (foreground)
simplex-bridge.sh listen
```

Send a test message from your phone and verify the response.

## SimpleX Chat CLI Setup

If simplex-chat is not installed:

```bash
# Download latest release
curl -L -o simplex-chat https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86-64
chmod +x simplex-chat
mv simplex-chat ~/.local/bin/

# Or on NixOS/with Nix
nix-env -iA nixpkgs.simplex-chat
```

## Troubleshooting

### simplex-chat not found

```bash
# Check installation
ls -la ~/.local/bin/simplex-chat

# Check PATH includes ~/.local/bin
echo $PATH | grep -q '.local/bin' && echo "OK" || echo "Add ~/.local/bin to PATH"
```

### Device not linked

1. Restart simplex-chat: `~/.local/bin/simplex-chat`
2. Check for existing profile: `ls ~/.local/share/simplex-chat/`
3. Re-link if needed: `/connect` in CLI, scan with phone

### Claude CLI not found

```bash
# Check claude is installed
which claude

# Check API key is configured
echo $ANTHROPIC_API_KEY
```

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop simplex-bridge
sudo systemctl disable simplex-bridge
sudo rm /etc/systemd/system/simplex-bridge.service

# Remove files
rm ~/bin/simplex-bridge.sh
rm -rf ~/.config/simplex-bridge
# Optionally remove logs: rm -rf ~/inbox/simplex
```
