# Communications Pack Verification

## Automated Checks

Run these commands to verify installation:

### 1. Check skills exist

```bash
for skill in Calendar Mail Slack Telegram Signal Comms; do
  if [ -f ~/.claude/skills/$skill/SKILL.md ]; then
    echo "✓ $skill skill installed"
  else
    echo "✗ $skill skill missing"
  fi
done
```

### 2. Check scripts exist

```bash
for script in signal-inbox.sh signal-interface.sh telegram-inbox.sh; do
  if [ -x ~/bin/$script ]; then
    echo "✓ $script installed"
  else
    echo "✗ $script missing or not executable"
  fi
done
```

## Manual Verification

### 1. Test Calendar skill

In Claude Code:
```
/calendar
```

Expected: Shows today's calendar events (from work or home based on context)

### 2. Test Mail skill

```
/mail
```

Expected: Shows recent inbox messages

### 3. Test Slack skill

```
/slack
```

Expected: Shows recent Slack messages or channel list

### 4. Test Telegram skill

```
/telegram
```

Expected: Shows recent Telegram messages or confirmation of bot status

### 5. Test Signal skill

```
/signal
```

Expected: Shows recent Signal messages or inbox status

### 6. Test Comms aggregation

```
/comms
```

Expected: Shows unified view across multiple platforms

## Context Routing Verification

### Test work context

```bash
PAI_CONTEXT=work claude -p "/calendar today"
```

Expected: Returns MS365 calendar events

### Test home context

```bash
PAI_CONTEXT=home claude -p "/calendar today"
```

Expected: Returns Google Calendar events

## Troubleshooting

### Skill not found

1. Check skill directory exists: `ls ~/.claude/skills/`
2. Verify SKILL.md has correct YAML frontmatter
3. Restart Claude Code session

### Authentication errors

1. Run `auth-keeper status` to check token status
2. Refresh expired tokens: `auth-keeper refresh <service>`
3. Re-login if needed: `auth-keeper login <service>`

### Signal not working

1. Check signal-cli is installed: `which signal-cli`
2. Verify device is linked: `signal-cli -u <number> receive --timeout 1`
3. Re-link if needed: `signal-cli link -n "imladris"`

### Telegram not working

1. Verify bot token in BWS: `bws secret get telegram-bot-token`
2. Test bot API: `curl "https://api.telegram.org/bot<token>/getMe"`

## Success Criteria

- [ ] All 6 skills installed (Calendar, Mail, Slack, Telegram, Signal, Comms)
- [ ] All helper scripts installed and executable
- [ ] `/calendar` returns events
- [ ] `/mail` returns inbox
- [ ] `/slack` connects to workspace
- [ ] `/telegram` shows bot status
- [ ] `/signal` shows inbox
- [ ] Context routing works (work vs home)
