# Query Workflow

Query items from the unified inbox cache.

## Quick Usage

```bash
# Get all items (limit 50)
inbox query

# Get unread items only
inbox query --unread

# Filter by source
inbox query --source slack

# Get items from last 2 hours
inbox query --since "2 hours ago"

# Get triaged items by priority
inbox query --triaged --priority P0,P1

# JSON output for scripting
inbox query --unread --json
```

## Filter Options

| Option | Description | Example |
|--------|-------------|---------|
| `--source` | Filter by source(s) | `--source slack,telegram` |
| `--unread` | Only unread items | `--unread` |
| `--triaged` | Only triaged items | `--triaged` |
| `--untriaged` | Only untriaged items | `--untriaged` |
| `--priority` | Filter by priority | `--priority P0,P1` |
| `--category` | Filter by category | `--category "Action-Required"` |
| `--since` | Items after time | `--since "1 day ago"` |
| `--limit` | Max items | `--limit 100` |

## Output Formats

### Human-Readable (default)

```
[UNREAD] slack | 1/22/2026, 3:45:00 PM
  From: John Smith
  Subject: Quick question about the API
  Preview: Hey, I was wondering if you could...
  ID: slack:C123456-1737572700.123456
```

### JSON (`--json`)

```json
[
  {
    "id": "slack:C123456-1737572700.123456",
    "source": "slack",
    "subject": "Quick question about the API",
    "from_name": "John Smith",
    "timestamp": "2026-01-22T15:45:00.000Z",
    "read_status": "unread"
  }
]
```

## Common Queries

```bash
# Unread items requiring action
inbox query --unread --triaged --category "Action-Required"

# Quick wins
inbox query --unread --triaged --quick-win

# Recent Slack messages
inbox query --source slack --since "4 hours ago"

# All SDP tickets
inbox query --source sdp-ticket,sdp-task
```

## Integration with InboxRank

The InboxRank skill (Layer 3) uses this query interface:

```bash
# InboxRank gets untriaged items
items=$(inbox query --untriaged --json)

# Applies AI categorization
# Then writes results back
inbox triage <id> --priority P1 --category "Action-Required"
```
