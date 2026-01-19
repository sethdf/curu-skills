# SimpleX Bridge Pack Verification

## Automated Checks

Run these commands to verify installation:

### 1. Check script installed

```bash
if [ -x ~/bin/simplex-bridge.sh ]; then
    echo "✓ simplex-bridge.sh installed"
else
    echo "✗ simplex-bridge.sh not found or not executable"
fi
```

### 2. Check dependencies

```bash
simplex-bridge.sh status
```

Expected output shows all dependencies with ✓

### 3. Check config file

```bash
if [ -f ~/.config/simplex-bridge/config.yaml ]; then
    echo "✓ Config file exists"
else
    echo "✗ Config file not found"
fi
```

### 4. Check log directory

```bash
if [ -d ~/inbox/simplex ]; then
    echo "✓ Log directory exists"
else
    echo "✗ Log directory not found"
fi
```

## Routing Logic Verification

Test the Haiku routing without sending messages:

### Test work context detection

```bash
simplex-bridge.sh test "Can you check my meeting schedule for the quarterly review?"
```

Expected: `{"context": "work", "skill": "calendar", ...}`

### Test home context detection

```bash
simplex-bridge.sh test "What should I make for dinner tonight?"
```

Expected: `{"context": "home", "skill": "none", ...}`

### Test skill detection

```bash
simplex-bridge.sh test "/calendar tomorrow"
```

Expected: `{"skill": "calendar", ...}`

```bash
simplex-bridge.sh test "/slack check #engineering"
```

Expected: `{"skill": "slack", ...}`

## End-to-End Verification

### 1. Manual listener test

Start the bridge in foreground:

```bash
simplex-bridge.sh listen
```

### 2. Send test message from phone

Open SimpleX app on phone and send:
```
What time is it?
```

### 3. Verify response

- Response should appear in SimpleX app on phone
- Log entry should appear in `~/inbox/simplex/$(date +%Y-%m-%d).md`

### 4. Test skill invocation

Send from phone:
```
/calendar today
```

Expected: Calendar events returned to phone

## Systemd Service Verification

If using systemd:

### 1. Check service status

```bash
sudo systemctl status simplex-bridge
```

Expected: `active (running)`

### 2. Check logs

```bash
journalctl -u simplex-bridge -f
```

### 3. Test auto-restart

```bash
# Kill the process
sudo systemctl kill simplex-bridge

# Wait 10 seconds
sleep 12

# Should auto-restart
sudo systemctl status simplex-bridge
```

## Troubleshooting

### No response to messages

1. Check simplex-chat is running: `pgrep -a simplex-chat`
2. Check bridge is listening: `simplex-bridge.sh status`
3. Check Claude CLI works: `claude -p "hello"`

### Routing incorrect

1. Test routing manually: `simplex-bridge.sh test "your message"`
2. Check config file: `cat ~/.config/simplex-bridge/config.yaml`
3. Verify context roots exist

### Messages not logging

1. Check log directory exists: `ls ~/inbox/simplex/`
2. Check write permissions: `touch ~/inbox/simplex/test && rm ~/inbox/simplex/test`

### Service fails to start

1. Check journalctl: `journalctl -u simplex-bridge -n 50`
2. Verify paths in service file match your setup
3. Run manually first to test: `simplex-bridge.sh listen`

## Success Criteria

- [ ] simplex-bridge.sh installed and executable
- [ ] Config file present at ~/.config/simplex-bridge/config.yaml
- [ ] Log directory exists at ~/inbox/simplex
- [ ] All dependencies available (simplex-chat, claude, jq)
- [ ] Routing tests return valid JSON
- [ ] Messages from phone receive responses
- [ ] Conversations logged correctly
- [ ] (Optional) Systemd service running and auto-restarts
