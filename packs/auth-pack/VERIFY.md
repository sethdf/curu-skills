# Auth Pack Verification

## Automated Checks

Run these commands to verify installation:

### 1. Check scripts exist

```bash
which auth-keeper.sh || which auth-keeper
which asudo.sh || which asudo
which bws-init.sh || which bws-init
which claude-backend.sh || which claude-backend
```

### 2. Check auth-keeper status

```bash
auth-keeper status
```

Expected output shows status for all configured services:
```
╭──────────────────────────────────────────────────────────────╮
│                    AUTH-KEEPER STATUS                         │
├──────────────────────────────────────────────────────────────┤
│ AWS           │ ✓ Authenticated (expires in 8h)               │
│ Azure         │ ✓ Authenticated                               │
│ MS365         │ ✓ Token valid (expires in 55m)               │
│ Google        │ ✓ Token valid (expires in 45m)               │
│ Slack         │ ✓ Token valid                                │
│ Telegram      │ ✓ Bot configured                             │
│ Signal        │ ✓ Device linked                              │
╰──────────────────────────────────────────────────────────────╯
```

### 3. Check BWS access

```bash
bws secret list 2>/dev/null && echo "✓ BWS accessible" || echo "✗ BWS not accessible"
```

## Manual Verification

### 1. Test AWS authentication

```bash
aws sts get-caller-identity
# Expected: Returns account and user info
```

### 2. Test Azure authentication

```bash
az account show
# Expected: Returns subscription info
```

### 3. Test MS365 token

```bash
# Check token exists and is not expired
jq -r '.ms365.expires_at' ~/.claude/.credentials.json
# Expected: Future timestamp
```

### 4. Test Google token

```bash
# Check token exists
jq -r '.google.access_token' ~/.claude/.credentials.json | head -c 20
# Expected: Token prefix
```

### 5. Test Slack token

```bash
# Quick API test
curl -s -H "Authorization: Bearer $(jq -r '.slack.access_token' ~/.claude/.credentials.json)" \
  https://slack.com/api/auth.test | jq .ok
# Expected: true
```

### 6. Test Telegram

```bash
# Check bot info
TELEGRAM_TOKEN=$(bws secret get telegram-bot-token -o json | jq -r .value)
curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe" | jq .ok
# Expected: true
```

### 7. Test Signal

```bash
signal-cli -u "+1234567890" receive --timeout 1
# Expected: No errors (may show "No messages")
```

## Troubleshooting

### auth-keeper command not found

1. Check ~/bin is in PATH: `echo $PATH | grep -q "$HOME/bin" && echo "OK" || echo "Add ~/bin to PATH"`
2. Verify scripts are executable: `ls -la ~/bin/auth-keeper*`

### BWS not accessible

1. Check BWS_ACCESS_TOKEN is set
2. Run `bws-init.sh` to reinitialize

### Token expired

1. Run `auth-keeper refresh <service>`
2. If refresh fails, run `auth-keeper login <service>`

### Signal not linked

1. Run `signal-cli link -n "imladris"`
2. Scan QR code with Signal app on phone

## Success Criteria

- [ ] All scripts are installed and executable
- [ ] `auth-keeper status` shows all services
- [ ] AWS, Azure have valid sessions
- [ ] MS365, Google, Slack tokens are valid
- [ ] Telegram bot responds
- [ ] Signal device is linked
