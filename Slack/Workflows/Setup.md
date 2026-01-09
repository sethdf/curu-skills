# Slack Setup Workflow

## Prerequisites

1. Slack workspace admin access (or ability to request app installation)
2. Bun runtime installed

## Step 1: Create Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter:
   - App Name: `CLI Bot` (or your preference)
   - Workspace: Select your workspace
5. Click **Create App**

## Step 2: Configure Bot Token Scopes

1. Go to **OAuth & Permissions**
2. Under **Scopes > Bot Token Scopes**, add:
   - `channels:read` - List channels
   - `channels:history` - Read channel messages
   - `chat:write` - Send messages
   - `users:read` - User info
   - `im:read` - Read DMs
   - `im:write` - Send DMs
   - `im:history` - DM history
   - `groups:read` - Private channels (optional)
   - `groups:history` - Private channel history (optional)

## Step 3: Install to Workspace

1. Go to **OAuth & Permissions**
2. Click **Install to Workspace**
3. Review permissions and click **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## Step 4: Configure Token

Option A: Environment variable (recommended):
```bash
export SLACK_BOT_TOKEN="xoxb-your-token-here"
```

Option B: Config file:
```bash
mkdir -p ~/.config/slack-cli
cat > ~/.config/slack-cli/config.json << 'EOF'
{
  "botToken": "xoxb-your-token-here"
}
EOF
chmod 600 ~/.config/slack-cli/config.json
```

## Step 5: Invite Bot to Channels

The bot can only read/write channels it's a member of:

1. Go to each channel you want the bot to access
2. Type `/invite @YourBotName`
3. Or mention the bot and click "Invite to channel"

## Step 6: Verify

```bash
bun run ~/.claude/skills/Slack/Tools/SlackClient.ts auth
```

## Optional: User Token for Search

Search requires a user token (not bot token):

1. In your Slack app, go to **OAuth & Permissions**
2. Under **User Token Scopes**, add:
   - `search:read`
3. Reinstall the app
4. Copy the **User OAuth Token** (starts with `xoxp-`)
5. Set: `export SLACK_USER_TOKEN="xoxp-..."`

## Troubleshooting

### "not_in_channel" error
Bot needs to be invited to the channel. Use `/invite @BotName`.

### "missing_scope" error
Add the required scope in Slack app settings, reinstall app.

### "invalid_auth" error
Token is incorrect or expired. Generate a new one.
