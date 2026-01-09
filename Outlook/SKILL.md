---
name: Outlook
description: Microsoft 365 Outlook email integration via Graph API. USE WHEN checking outlook, sending m365 email, searching outlook, managing folders. Invoke with /outlook.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Outlook

CLI-first Microsoft 365 email integration using Microsoft Graph API. Token-efficient - loads only when invoked.

## Quick Start

```bash
/outlook                     # Interactive triage (unread summary)
/outlook unread              # List unread messages
/outlook search "from:boss"  # Search messages
/outlook read <messageId>    # Show full message
/outlook reply <messageId>   # Draft reply
/outlook send                # Compose new message
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup outlook", "configure m365" | `Workflows/Setup.md` |
| **Triage** | "/outlook", "check outlook" | `Workflows/Triage.md` |

## Authentication

Microsoft Graph uses OAuth 2.0 via Azure AD. Tokens stored in `~/.config/outlook-cli/`:

```bash
~/.config/outlook-cli/
├── credentials.json      # Azure app registration details
└── token.json           # Access/refresh tokens (auto-generated)
```

### Required Environment Variables

```bash
export MS_CLIENT_ID="your-azure-app-client-id"
export MS_CLIENT_SECRET="your-azure-app-client-secret"  # Optional for public clients
export MS_TENANT_ID="common"  # or specific tenant
```

### API Permissions (Delegated)

Minimal scopes for security:
- `Mail.Read` - Read messages
- `Mail.Send` - Send messages
- `Mail.ReadWrite` - Modify, move, delete messages
- `User.Read` - Basic profile info

## Tool Usage

The `Tools/OutlookClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/Outlook/Tools/OutlookClient.ts <command> [args]

# Commands:
#   auth              - Authenticate (device code flow)
#   unread [max]      - List unread messages
#   search <q> [max]  - Search with OData filter or KQL
#   read <id>         - Read full message
#   reply <id>        - Start reply (body from stdin)
#   send <to> <subj>  - Send message (body from stdin)
#   folders           - List mail folders
#   move <id> <folder> - Move message to folder
#   archive <id>      - Archive message
#   delete <id>       - Move to deleted items
```

## Search Syntax

Microsoft Graph supports OData filters and KQL:

```bash
# OData filter examples
/outlook search "from/emailAddress/address eq 'boss@company.com'"
/outlook search "isRead eq false"
/outlook search "hasAttachments eq true"

# Simple KQL (via $search)
/outlook search "subject:meeting"
/outlook search "from:alice"
```

## Examples

**Example 1: Morning triage**
```
User: "/outlook"
-> Lists unread count by sender
-> Shows focused inbox items first
-> Offers quick actions (archive, reply, move)
```

**Example 2: Search and reply**
```
User: "/outlook search from:manager"
-> Shows matching messages
User: "/outlook reply abc123"
-> Opens draft with quoted original
-> AI assists with response
```

**Example 3: Folder management**
```
User: "Move all newsletters to Archive"
-> Searches for newsletter senders
-> Moves matching messages
-> Reports count processed
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Token expired | Run `auth` command |
| `403 Forbidden` | Missing permission | Check Azure app permissions |
| `429 Throttled` | Rate limit | Wait and retry |
| `InvalidAuthenticationToken` | Token invalid | Re-authenticate |
