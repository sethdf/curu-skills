---
name: InboxRank
description: "[DEPRECATED] Triage is now built into 'intake triage'. See UnifiedInbox/DEPRECATED.md."
deprecated: true
successor: imladris/lib/intake/triage
---

> **DEPRECATED**: This skill is deprecated. The Intake System now includes built-in triage with:
> - Enrichment (dates, entities via chrono-node/compromise)
> - Deterministic rules (json-rules-engine)
> - Similarity search (vector-based classification)
> - AI (only for ambiguous cases)
>
> Use `intake triage run` instead.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/InboxRank/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# InboxRank (Layer 3 - AI Prompting)

AI-powered categorization and prioritization for the unified inbox. This is the **AI layer** built on top of UnifiedInbox.

## Quick Start

```bash
inboxrank                         # Triage untriaged items
inboxrank --source slack          # Triage specific source
inboxrank --limit 20              # Limit items to process
inboxrank --dry-run               # Show results without saving
inboxrank report                  # Generate triage report
inboxrank suggest                 # Get next-action suggestion
```

## Architecture

InboxRank is **Layer 3** of the PAI inbox infrastructure:

```
Layer 3: InboxRank (AI)      ← THIS SKILL - AI categorization
Layer 2: UnifiedInbox (CLI)  ← Deterministic operations (inbox query, inbox triage)
Layer 1: _shared/api/        ← Source adapters
```

**How It Works:**
1. Query untriaged items via `inbox query --untriaged --json`
2. Apply AI categorization to each item
3. Write results back via `inbox triage <id> --priority P1 --category "..."`

## Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Action-Required** | Needs your direct action | Request for decision, assigned task |
| **FYI** | Informational, no action needed | Status update, newsletter |
| **Delegatable** | Can be handed off to someone else | Request within someone else's domain |
| **Spam** | Unwanted or irrelevant | Marketing, automated alerts |
| **Archive** | Completed or no longer relevant | Old thread, resolved issue |

## Priority Levels

| Priority | Description | Response Time |
|----------|-------------|---------------|
| **P0** | Critical/Urgent | Immediate (< 1 hour) |
| **P1** | High priority | Today |
| **P2** | Normal | This week |
| **P3** | Low priority | When convenient |

## Priority Scoring Model

InboxRank uses a multi-factor scoring model:

### Base Score (from category)
- Action-Required: 60
- Delegatable: 40
- FYI: 20
- Spam/Archive: 0

### Modifiers

| Factor | Modifier | Trigger |
|--------|----------|---------|
| VIP sender | +30 | Sender in VIP contacts |
| Overdue | +25 | Past due date (tickets/tasks) |
| Due today | +15 | Due within 24 hours |
| High priority (source) | +20 | Source marks as urgent |
| Has attachment | +5 | Contains attachments |
| Thread reply | +10 | Reply in existing thread |
| Slack DM | +10 | Direct message (not channel) |
| Old item | +5 | > 48 hours old, still unread |

### Score to Priority Mapping
- 80+: P0 (Critical)
- 60-79: P1 (High)
- 40-59: P2 (Normal)
- 0-39: P3 (Low)

## Quick Win Detection

An item is marked as a **Quick Win** if:
- Category is Action-Required AND
- Estimated effort < 5 minutes AND
- Can be completed immediately (no dependencies)

Quick win reasons:
- Simple yes/no decision
- One-line response
- Quick approval/rejection
- Acknowledgment needed
- Simple lookup/answer

## Commands

### inboxrank (default)

Triage untriaged items.

```bash
inboxrank                         # Triage all untriaged
inboxrank --source email-ms365    # Specific source
inboxrank --limit 10              # Limit items
inboxrank --dry-run               # Preview without saving
inboxrank --verbose               # Show AI reasoning
```

### inboxrank report

Generate triage report.

```bash
inboxrank report                  # Markdown report
inboxrank report --json           # JSON format
inboxrank report --format md      # Explicit markdown
```

### inboxrank suggest

Get next-action suggestion.

```bash
inboxrank suggest                 # What to work on next
inboxrank suggest --quick-wins    # Only quick wins
inboxrank suggest --source slack  # From specific source
```

### inboxrank review

Interactive review of triaged items (for corrections).

```bash
inboxrank review                  # Review recent triages
inboxrank review --priority P0    # Review P0 items
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Rank** | "triage inbox", "rank messages" | `Workflows/Rank.md` |
| **Report** | "inbox report", "triage report" | `Workflows/Report.md` |
| **Review** | "review triage", "check classifications" | `Workflows/Review.md` |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `INBOXRANK_MODEL` | AI model for inference | standard (Sonnet) |
| `INBOXRANK_BATCH_SIZE` | Items per batch | 10 |
| `INBOXRANK_VERBOSE` | Show reasoning | false |

## Integration with UnifiedInbox

InboxRank is built entirely on the UnifiedInbox CLI:

```typescript
// 1. Get untriaged items
const items = await $`inbox query --untriaged --json`.json();

// 2. Apply AI categorization (this is the only AI step)
for (const item of items) {
  const result = await aiCategorize(item);

  // 3. Write back via deterministic CLI
  await $`inbox triage ${item.id} \
    --priority ${result.priority} \
    --category "${result.category}" \
    --confidence ${result.confidence} \
    --reasoning "${result.reasoning}"`;
}
```

## AI Prompt Structure

The categorization prompt includes:
- Item metadata (source, timestamp, sender)
- Subject and body preview
- Thread context (if available)
- VIP status
- Source-specific context (ticket status, due dates)

The AI returns:
- Category (Action-Required, FYI, etc.)
- Priority (P0-P3)
- Confidence (1-10)
- Quick win flag and reason
- Estimated time
- Reasoning
- Suggested action

## Related Skills

- **UnifiedInbox** (Layer 2): Deterministic CLI this skill builds on
- **Mail**: Direct email operations
- **Slack**: Direct Slack operations
- **SDPRequests**: Direct SDP ticket operations
