# Rank Workflow

AI-powered categorization and prioritization of inbox items.

## Quick Usage

```bash
# Triage untriaged items (default: 10 items)
inboxrank

# Triage specific source
inboxrank --source slack

# Preview without saving
inboxrank --dry-run --verbose

# Process more items
inboxrank --limit 50

# Only quick wins
inboxrank --quick-wins
```

## How It Works

1. **Query** untriaged items via `inbox query --untriaged --json`
2. **Categorize** each item using AI (Claude via PAI inference tool)
3. **Score** priority using deterministic scoring model
4. **Detect** quick wins based on content patterns
5. **Write** results back via `inbox triage`

## AI Categorization

The AI receives:
- Item metadata (source, sender, timestamp)
- Subject and body preview
- Thread context (if available)
- VIP status
- Source-specific context (ticket status, due dates)

The AI returns:
- Category (Action-Required, FYI, Delegatable, Spam, Archive)
- Confidence (1-10)
- Reasoning
- Suggested action

## Priority Scoring

Priority is calculated deterministically from:
- Base score (by category)
- VIP modifier (+30)
- Overdue modifier (+25)
- Due today modifier (+15)
- High priority source modifier (+20)
- Attachment modifier (+5)
- Thread reply modifier (+10)
- Slack DM modifier (+10)
- Old item modifier (+5)

See `SKILL.md` for full scoring model.

## Output Example

```
============================================================
TRIAGE RESULTS
============================================================

[P0] Action-Required | slack
  From: John Smith
  Subject: Quick question about the API
  ⚡ Quick Win: Simple yes/no decision
  Time: 2min | ID: slack:C123456-1737572700

[P1] Action-Required | email-ms365
  From: Jane Doe
  Subject: Review PR #123
  Time: 15min | ID: email-ms365:AAMk...

============================================================
SUMMARY
============================================================
Total: 10 | P0: 2 | P1: 3 | P2: 4 | P3: 1
Quick Wins: 3
```

## Options

| Option | Description |
|--------|-------------|
| `--source, -s` | Filter by source |
| `--limit, -l` | Max items to process (default: 10) |
| `--dry-run, -n` | Preview without saving |
| `--verbose, -v` | Show AI reasoning |
| `--json` | Output JSON format |
| `--quick-wins` | Only show quick wins |

## Integration

This workflow is Layer 3 (AI Prompting) built on:
- Layer 2: UnifiedInbox CLI (`inbox query`, `inbox triage`)
- Layer 1: `_shared/api/` source adapters
