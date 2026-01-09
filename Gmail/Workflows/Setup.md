# Gmail OAuth Setup Workflow

## Prerequisites

1. Google Cloud Console account
2. Bun runtime installed

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Note your Project ID

## Step 2: Enable Gmail API

```bash
# Or via console: APIs & Services > Enable APIs > Gmail API
gcloud services enable gmail.googleapis.com
```

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** (or Internal if Workspace)
3. Fill required fields:
   - App name: `Gmail CLI`
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
5. Add test users (your email)

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Desktop app**
4. Name: `Gmail CLI`
5. Download JSON

## Step 5: Install Credentials

```bash
# Create config directory
mkdir -p ~/.config/gmail-cli

# Move downloaded credentials
mv ~/Downloads/client_secret_*.json ~/.config/gmail-cli/credentials.json

# Secure permissions
chmod 600 ~/.config/gmail-cli/credentials.json
```

## Step 6: Authenticate

```bash
# Run auth flow (opens browser)
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts auth

# This will:
# 1. Open browser to Google login
# 2. Request permission for scopes
# 3. Save token.json to ~/.config/gmail-cli/
```

## Step 7: Verify

```bash
# Test authentication
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts unread

# Should show unread message count
```

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Ensure redirect URI in credentials matches: `http://localhost:3000/oauth2callback`
- Or use `urn:ietf:wg:oauth:2.0:oob` for manual copy/paste flow

### "Token has been expired or revoked"
```bash
# Delete old token and re-auth
rm ~/.config/gmail-cli/token.json
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts auth
```

### "Insufficient Permission"
- Re-run auth to add missing scopes
- Check OAuth consent screen has all required scopes
