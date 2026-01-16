---
name: Mail
description: Context-aware email management via auth-keeper. USE WHEN checking email OR sending email OR searching mail OR inbox triage OR reading messages. Routes to MS365 (work) or Gmail (home) based on CONTEXT.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Mail

Context-aware email skill using auth-keeper backend. Automatically routes to MS365 (work context) or Gmail (home context).

## Context Routing

| Context | Backend | Command |
|---------|---------|---------|
| `work` | MS365 Graph API (PowerShell) | `auth-keeper ms365 "Get-MgUserMessage..."` |
| `home` | Gmail API (curl) | `auth-keeper google mail` |

**Detection:** Uses `$CONTEXT` environment variable set by direnv.

## Quick Reference

```bash
# Check context
echo $CONTEXT

# Work context (MS365)
auth-keeper ms365 "Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Top 10"
auth-keeper ms365 "Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Filter 'isRead eq false' -CountVariable c -Top 1; \$c"

# Home context (Gmail)
auth-keeper google mail
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Triage** | "check email", "inbox", "unread" | `Workflows/Triage.md` |
| **Search** | "search email", "find messages" | `Workflows/Search.md` |
| **Read** | "read message", "show email" | `Workflows/Read.md` |

## Examples

**Example 1: Morning triage**
```
User: "Check my email"
→ Detects CONTEXT (work or home)
→ If work: runs auth-keeper ms365 to list unread
→ If home: runs auth-keeper google mail
→ Shows unread count and recent messages
```

**Example 2: Search for specific emails**
```
User: "Find emails from alice about the project"
→ Detects CONTEXT
→ If work: Get-MgUserMessage -Filter "contains(from/emailAddress/address, 'alice')"
→ If home: auth-keeper google mail with search query
→ Returns matching messages
```

**Example 3: Bulk triage**
```
User: "How many unread emails do I have?"
→ Detects CONTEXT
→ If work: Get-MgUserMessage -Filter 'isRead eq false' -CountVariable c
→ If home: Gmail API unread count
→ Returns: "You have X unread emails"
```

## MS365 PowerShell Commands

Common commands for work context:

```powershell
# List messages
Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Top 20

# Unread count
Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Filter 'isRead eq false' -CountVariable c -Top 1; $c

# Search by sender
Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Filter "contains(from/emailAddress/address, 'someone@example.com')"

# Mark as read
Update-MgUserMessage -UserId 'sfoley@buxtonco.com' -MessageId $id -IsRead:$true

# Move to folder
Move-MgUserMessage -UserId 'sfoley@buxtonco.com' -MessageId $id -DestinationId $folderId
```

## Gmail Commands

Commands for home context:

```bash
# List unread
auth-keeper google mail

# Get access token for custom queries
TOKEN=$(auth-keeper google --token)
curl -s "https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `CONTEXT not set` | Not in work/home directory | `cd` to context directory or `export CONTEXT=work` |
| `BWS not available` | Bitwarden Secrets not initialized | Run `bws login` |
| `Token expired` | Google OAuth expired | Run `auth-keeper google --auth` |
