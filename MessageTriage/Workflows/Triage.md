# Triage Workflow

**Interactive message triage - defaults to instant cached results.**

Cron jobs continuously export and categorize messages in the background. Interactive queries just read from cache for instant results.

## Default Behavior: Cached (Instant)

When user asks to "triage inbox" or "check messages", **default to cached results**:

```bash
bun Tools/AutoTriage.ts --source email --cached
```

This returns instantly from SQLite cache - no API calls, no AI inference.

## When to Use Fresh Mode

Only use `--fresh` when user explicitly asks:
- "get current/latest emails"
- "refresh triage"
- "re-categorize messages"

```bash
bun Tools/AutoTriage.ts --source email --fresh --limit 50
```

## Step 1: Detect Source

| User Says | Source |
|-----------|--------|
| "inbox", "email", "ms365", "outlook" | `email` |
| "#channel", "slack", "channel" | `slack` |
| Default | `email` |

## Step 2: Query Cache (Default)

```bash
# Instant cached results
bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts \
  --source email \
  --cached
```

Output includes:
- Total messages (last 24 hours)
- Action-required count
- Category breakdown
- Top action items with confidence scores

## Step 3: Present Results

Format the cached results for the user:

```markdown
## Email Triage Summary

**Action Required:** 12 messages need attention
**Total Categorized:** 127 messages (last 24 hours)

### By Category
| Category | Count | Avg Confidence |
|----------|-------|----------------|
| SaaS-Notifications | 45 | 9.5 |
| FYI-Internal | 31 | 8.1 |
| Colleagues | 23 | 8.4 |
| Vendor-Sales | 16 | 7.8 |
| Action-Required | 12 | 7.2 |

### Action Required Items
1. alice@example.com - "Budget approval needed" (conf: 9)
2. bob@example.com - "PR review request" (conf: 8)
...
```

## Step 4: Offer Actions (Optional)

If user wants to act on results:

### Archive by Category
```bash
# User: "Archive all SaaS notifications"
# → Query cache for SaaS-Notifications IDs
# → Bulk move to archive via MS365
```

### Mark as Read
```bash
# User: "Mark all FYI-Internal as read"
# → Query cache for FYI-Internal IDs
# → Bulk update via MS365
```

## Fresh Mode (On Request)

When user explicitly requests fresh data:

```bash
# Full export + AI categorization
bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts \
  --source email \
  --fresh \
  --limit 100 \
  --verbose
```

This takes 30-60 seconds depending on message count.

## Cron Background Jobs

These run automatically to keep cache fresh:

```cron
# Email: every 5 minutes
*/5 * * * * bun /path/to/AutoTriage.ts --source email --quiet

# Slack: every 60 seconds
* * * * * bun /path/to/AutoTriage.ts --source slack --channel general --quiet
```

With these running, interactive queries are always instant.

## Decision Tree

```
User: "Triage my inbox"
         │
         ▼
    ┌─────────────────┐
    │ Explicit fresh? │
    │ ("current",     │
    │  "refresh",     │
    │  "re-categorize")│
    └────────┬────────┘
             │
      No     │     Yes
      ▼      │      ▼
  ┌──────┐   │  ┌──────────┐
  │--cached│  │  │--fresh   │
  │Instant │  │  │30-60 sec │
  └──────┘   │  └──────────┘
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Empty cache | "No cached results. Running fresh triage..." → --fresh |
| Stale cache (>1 hour) | Show results + "Cache is 2 hours old. Run fresh?" |
| Cache DB missing | Initialize + run --fresh |
