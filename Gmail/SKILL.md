---
name: Gmail
description: Gmail API integration for email management. USE WHEN checking email, sending email, searching gmail, drafting replies, managing labels. Invoke with /gmail.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Gmail

CLI-first Gmail integration using the Gmail API directly. Designed for token efficiency - loads only when invoked.

## Quick Start

```bash
/gmail                    # Interactive triage (unread summary)
/gmail unread             # Count and list unread
/gmail search "from:boss subject:urgent"
/gmail read <messageId>   # Show full message
/gmail reply <messageId>  # Draft reply
/gmail send               # Compose new message
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Setup** | "setup gmail", "configure oauth" | `Workflows/Setup.md` |
| **Triage** | "/gmail", "check email" | `Workflows/Triage.md` |

## Authentication

Gmail uses OAuth 2.0. Tokens stored in `~/.config/gmail-cli/`:

```bash
~/.config/gmail-cli/
├── credentials.json      # OAuth client (from Google Cloud Console)
└── token.json           # Access/refresh tokens (auto-generated)
```

### Required Environment Variables

```bash
# Optional: Override default paths
export GMAIL_CREDENTIALS="$HOME/.config/gmail-cli/credentials.json"
export GMAIL_TOKEN="$HOME/.config/gmail-cli/token.json"
```

### OAuth Scopes

Minimal scopes for security:
- `gmail.readonly` - Read messages and labels
- `gmail.send` - Send messages
- `gmail.modify` - Modify labels, archive, trash
- `gmail.labels` - Manage labels

## Tool Usage

The `Tools/GmailClient.ts` provides all operations:

```bash
# Run directly with bun
bun run ~/.claude/skills/Gmail/Tools/GmailClient.ts <command> [args]

# Commands:
#   auth          - Authenticate (opens browser)
#   unread        - List unread messages
#   search <q>    - Search with Gmail query syntax
#   read <id>     - Read full message
#   reply <id>    - Start reply draft
#   send          - Compose and send
#   labels        - List all labels
#   label <id> <label>  - Apply label to message
#   archive <id>  - Archive message
#   trash <id>    - Move to trash
```

## Gmail Search Syntax

Use standard Gmail search operators:

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:alice@example.com` | Sender |
| `to:` | `to:me` | Recipient |
| `subject:` | `subject:meeting` | Subject line |
| `is:` | `is:unread`, `is:starred` | Message state |
| `has:` | `has:attachment` | Has attachment |
| `after:` | `after:2024/01/01` | Date filter |
| `label:` | `label:work` | By label |
| `in:` | `in:inbox`, `in:sent` | Location |

Combine with AND (space), OR, `-` (NOT):
```
from:boss is:unread -subject:newsletter
```

## Examples

**Example 1: Morning triage**
```
User: "/gmail"
-> Lists unread count by sender
-> Shows high-priority messages first
-> Offers quick actions (archive, reply, label)
```

**Example 2: Search and reply**
```
User: "/gmail search from:alice@example.com after:2024/01/01"
-> Shows matching messages
User: "/gmail reply abc123"
-> Opens draft with quoted original
-> AI assists with response
```

**Example 3: Bulk operations**
```
User: "Archive all newsletters from this week"
-> Searches: "label:newsletters after:7d"
-> Archives matching messages
-> Reports count processed
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Token expired | Run `bun GmailClient.ts auth` |
| `403 Forbidden` | Insufficient scope | Re-auth with correct scopes |
| `429 Rate Limit` | Too many requests | Wait and retry |
| `ENOENT credentials.json` | Missing OAuth client | See Setup workflow |
