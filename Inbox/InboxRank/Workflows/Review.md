# Review Workflow

Interactive review and correction of AI triage decisions.

## Quick Usage

```bash
# Review recent triages
inboxrank review

# Review specific priority
inboxrank review --priority P0

# Review specific source
inboxrank review --source slack
```

## Purpose

The review workflow allows you to:
- Verify AI categorization accuracy
- Correct misclassified items
- Train your intuition about the scoring model
- Build confidence in the triage system

## Current Implementation

The interactive TUI is planned but not yet implemented. For now, use these alternatives:

### Preview Triage Decisions

```bash
# Dry run with verbose output to see reasoning
inboxrank --dry-run --verbose

# Check specific source
inboxrank --source slack --dry-run --verbose --limit 5
```

### Query Triaged Items

```bash
# See all triaged items
inbox query --triaged --json | jq '.[].subject'

# See P0 items only
inbox query --triaged --priority P0

# See quick wins
inbox query --triaged --quick-win
```

### Manual Override

To manually override a triage decision:

```bash
# Change priority and category
inbox triage <item-id> --priority P1 --category "Action-Required"

# Mark as spam
inbox triage <item-id> --priority P3 --category "Spam"

# Flag as quick win
inbox triage <item-id> --quick-win --quick-win-reason "Simple approval"
```

## Planned Features

The future interactive review will include:
- Terminal UI for browsing triaged items
- Side-by-side comparison of AI vs manual decisions
- Batch operations for similar items
- Feedback loop to improve categorization

## Correction Best Practices

1. **Review P0s First** - High priority items have the highest cost of miscategorization
2. **Check Quick Wins** - Verify quick wins are actually quick
3. **Validate VIP Detection** - Ensure VIP senders are being boosted correctly
4. **Monitor Categories** - Watch for patterns in miscategorization

## Metrics to Track

- Categorization accuracy rate
- Priority distribution over time
- Quick win completion rate
- Time saved per triage cycle
