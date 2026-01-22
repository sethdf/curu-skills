# Report Workflow

Generate triage reports from categorized inbox items.

## Quick Usage

```bash
# Generate markdown report
inboxrank report

# JSON format
inboxrank report --json

# Explicit format
inboxrank report --format md
inboxrank report --format json

# Filter by source
inboxrank report --source slack
```

## Report Contents

The triage report includes:
- Generation timestamp
- Total items count
- Items grouped by source
- Recent items with details

## Markdown Format

```markdown
# Inbox Triage Report

Generated: 2026-01-22T16:00:00.000Z

Total items: 45

## By Source

- **slack**: 20 items
- **email-ms365**: 15 items
- **sdp-ticket**: 10 items

## Recent Items

- [slack] Quick question about the API
  From: John Smith | 2026-01-22T15:45:00.000Z

- [email-ms365] Review PR #123
  From: Jane Doe | 2026-01-22T14:30:00.000Z
```

## JSON Format

```json
[
  {
    "item": {
      "id": "slack:C123456-1737572700",
      "source": "slack",
      "subject": "Quick question about the API",
      "fromName": "John Smith",
      "timestamp": "2026-01-22T15:45:00.000Z"
    },
    "triage": {
      "category": "Action-Required",
      "priority": "P0",
      "confidence": 8,
      "quickWin": true
    }
  }
]
```

## Options

| Option | Description |
|--------|-------------|
| `--format, -f` | Output format (md, json) |
| `--json` | Shortcut for `--format json` |
| `--source, -s` | Filter by source |
| `--limit, -l` | Max items to include (default: 100) |
| `--priority, -p` | Filter by priority |

## Use Cases

1. **Daily Review** - Start day with `inboxrank report` to see what's pending
2. **Source Analysis** - Use `--source` to analyze specific channel load
3. **Automation** - Use `--json` for integration with other tools
4. **Dashboards** - Pipe JSON output to monitoring systems
