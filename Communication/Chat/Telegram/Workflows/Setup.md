# Telegram Setup Workflow

## Prerequisites

1. Telegram account
2. Bun runtime installed

## Step 1: Create Bot with @BotFather

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts:
   - Enter bot name (display name): `My CLI Bot`
   - Enter username (must end in `bot`): `mycli_bot`
4. Copy the **HTTP API token** (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## Step 2: Configure Token

Option A: Environment variable (recommended):
```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
```

Option B: Config file:
```bash
mkdir -p ~/.config/telegram-cli
cat > ~/.config/telegram-cli/config.json << 'EOF'
{
  "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
}
EOF
chmod 600 ~/.config/telegram-cli/config.json
```

## Step 3: Get Your Chat ID

1. Send a message to your bot in Telegram (search for @yourbot_username)
2. Send `/start` to initiate conversation
3. Run:
   ```bash
   bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts updates
   ```
4. Note the `Chat ID` from the output

## Step 4: Save Chat ID

```bash
export TELEGRAM_CHAT_ID="123456789"
```

Or create aliases file:
```bash
cat > ~/.config/telegram-cli/chats.json << 'EOF'
{
  "aliases": {
    "me": "123456789",
    "family": "-100987654321"
  }
}
EOF
```

## Step 5: Verify

```bash
bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts auth
bun run ~/.claude/skills/Telegram/Tools/TelegramClient.ts send me "Hello from CLI!"
```

## Optional: Bot Settings via @BotFather

Customize your bot:
- `/setdescription` - Bot description
- `/setabouttext` - About section
- `/setuserpic` - Profile picture
- `/setcommands` - Command menu

## Adding Bot to Groups

1. Add the bot to a group
2. Send a message in the group
3. Run `updates` to get the group's chat ID (negative number)
4. Save as alias: `"family": "-100123456789"`

## Troubleshooting

### "chat not found" error
- Make sure you've sent at least one message to the bot first
- Run `updates` to verify the chat ID

### "bot was blocked by the user"
- Open chat with bot and send `/start`

### Bot not receiving group messages
- In @BotFather, use `/setprivacy` and set to "Disable"
- This allows bot to see all group messages
