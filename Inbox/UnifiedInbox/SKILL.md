---
name: UnifiedInbox
description: "[DEPRECATED] Use 'intake' CLI instead. See DEPRECATED.md for migration."
deprecated: true
successor: imladris/lib/intake
---

> **DEPRECATED**: This skill is deprecated in favor of the Intake System.
> Use `intake sync`, `intake query`, `intake stats` instead.
> See `DEPRECATED.md` in this directory for migration details.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/UnifiedInbox/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# UnifiedInbox (Layer 2 - Deterministic CLI)

CLI-first unified inbox for all message sources. This is the **deterministic layer** - no AI, just data operations.

## Quick Start

```bash
inbox sync                       # Sync all sources
inbox sync --source email-ms365  # Sync specific source
inbox query --unread             # Get unread items
inbox query --source slack       # Filter by source
inbox stats                      # Show inbox statistics
inbox mark-read <item-id>        # Mark item as read
inbox triage <item-id> --priority P1 --category "Action-Required"
```

## Architecture

UnifiedInbox is **Layer 2** of the PAI inbox infrastructure:

```
Layer 3: InboxRank (AI)      ← AI categorization, calls inbox CLI
Layer 2: UnifiedInbox (CLI)  ← THIS SKILL - deterministic operations
Layer 1: _shared/api/        ← Source adapters (ms365, gmail, slack, etc.)
```

**Design Principles:**
- Deterministic: Same input = same output (no AI)
- CLI-First: All operations available via command line
- Vendor-Agnostic: Skills don't know about MS365 vs Gmail
- Cache-Based: SQLite at `/data/.cache/unified-inbox/`

## Supported Sources

| Source | Type | Adapter |
|--------|------|---------|
| `email-ms365` | Email | Microsoft Graph API |
| `email-gmail` | Email | Gmail API |
| `slack` | Chat | slackdump SQLite |
| `telegram` | Chat | Telegram Bot API |
| `sdp-ticket` | Ticket | ServiceDesk Plus API |
| `sdp-task` | Task | ServiceDesk Plus API |

## Commands

### inbox sync

Sync items from sources to local cache.

```bash
inbox sync                           # All sources
inbox sync --source email-ms365      # Single source
inbox sync --source slack,telegram   # Multiple sources
inbox sync --since "1 day ago"       # Only recent items
inbox sync --dry-run                 # Show what would sync
```

### inbox query

Query cached items.

```bash
inbox query                          # All items (limit 50)
inbox query --unread                 # Only unread
inbox query --source slack           # Filter by source
inbox query --limit 100              # Adjust limit
inbox query --json                   # JSON output
inbox query --since "2 hours ago"    # Time filter
inbox query --triaged                # Only triaged items
inbox query --untriaged              # Only untriaged items
inbox query --priority P0,P1         # Filter by priority
inbox query --category "Action-Required"
```

### inbox stats

Show inbox statistics.

```bash
inbox stats                          # Summary
inbox stats --source email-ms365     # By source
inbox stats --json                   # JSON output
```

### inbox mark-read

Mark items as read.

```bash
inbox mark-read <item-id>            # Single item
inbox mark-read --source slack       # All items from source
```

### inbox triage

Write triage results (used by InboxRank Layer 3).

```bash
inbox triage <item-id> --priority P1 --category "Action-Required"
inbox triage <item-id> --priority P2 --category "FYI" --quick-win
inbox triage <item-id> --confidence 8 --reasoning "VIP sender"
```

## Cache Location

All data is stored in LUKS-encrypted storage:

```
/data/.cache/unified-inbox/
├── inbox.sqlite     # Main database
├── sync-state.json  # Per-source cursors
└── sync.log         # Audit trail
```

## Database Schema

See `references/schema.md` for full schema documentation.

Key tables:
- `items` - Normalized items from all sources
- `triage` - AI/user triage results
- `sync_state` - Per-source sync tracking
- `contacts` - VIP and contact information

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Sync** | "sync inbox", "update inbox" | `Workflows/Sync.md` |
| **Query** | "check inbox", "show messages" | `Workflows/Query.md` |
| **CronSetup** | "setup cron", "automated sync" | `Workflows/CronSetup.md` |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `UNIFIED_INBOX_DB` | Database path | `/data/.cache/unified-inbox/inbox.sqlite` |
| `ZONE` | work/home routing | Required for some sources |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Source not configured` | Missing credentials | Check BWS secrets |
| `Database locked` | Concurrent access | Wait and retry |
| `Sync failed` | API error | Check `sync.log` |

## Related Skills

- **InboxRank** (Layer 3): AI categorization built on this CLI
- **Mail**: Email operations (uses same `_shared/api/`)
- **Slack**: Direct Slack access
- **Telegram**: Direct Telegram access
