# Outlook OAuth Setup Workflow

## Prerequisites

1. Microsoft 365 account (personal or work)
2. Azure Portal access (for app registration)
3. Bun runtime installed

## Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Configure:
   - Name: `Outlook CLI`
   - Supported account types: Choose based on your needs
     - Personal only: "Personal Microsoft accounts only"
     - Work only: "Accounts in this organizational directory only"
     - Both: "Accounts in any organizational directory and personal"
   - Redirect URI: Leave blank (using device code flow)
5. Click **Register**

## Step 2: Note Application Details

After registration, note:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (or use "common")

## Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission > Microsoft Graph > Delegated permissions**
3. Add these permissions:
   - `Mail.Read`
   - `Mail.Send`
   - `Mail.ReadWrite`
   - `User.Read`
   - `offline_access`
4. Click **Grant admin consent** (if you're an admin)

## Step 4: Enable Public Client Flow

1. Go to **Authentication**
2. Under **Advanced settings**, set **Allow public client flows** to **Yes**
3. Save

## Step 5: Save Credentials

Option A: Environment variables (recommended):
```bash
export MS_CLIENT_ID="your-client-id"
export MS_TENANT_ID="common"  # or specific tenant
```

Option B: Config file:
```bash
mkdir -p ~/.config/outlook-cli

cat > ~/.config/outlook-cli/credentials.json << 'EOF'
{
  "clientId": "your-client-id",
  "tenantId": "common"
}
EOF

chmod 600 ~/.config/outlook-cli/credentials.json
```

## Step 6: Authenticate

```bash
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts auth
```

This will:
1. Display a URL and code
2. Open browser to Microsoft login
3. Enter the code when prompted
4. Grant permissions
5. Save tokens locally

## Step 7: Verify

```bash
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts unread
```

## Troubleshooting

### "AADSTS700016: Application not found"
- Verify client ID is correct
- Check tenant ID matches where app is registered

### "AADSTS65001: User needs to consent"
- Re-run auth flow
- Ensure all required permissions are added

### "AADSTS7000218: Request body must contain client_secret"
- Enable "Allow public client flows" in Authentication settings

### Token refresh fails
```bash
rm ~/.config/outlook-cli/token.json
bun run OutlookClient.ts auth
```
