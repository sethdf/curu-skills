# Report Workflow

Generate a comprehensive triage report with statistics and trends.

## Step 1: Fetch All Assigned Tickets

```bash
auth-keeper sdp
```

## Step 2: Run Triage Analysis

Execute the Triage workflow logic to categorize all tickets into P0-P3 tiers.

## Step 3: Calculate Statistics

```python
stats = {
    "total": len(tickets),
    "by_tier": {
        "P0": count of P0,
        "P1": count of P1,
        "P2": count of P2,
        "P3": count of P3
    },
    "by_priority": {
        "Urgent": count,
        "High": count,
        "Medium": count,
        "Low": count
    },
    "overdue_count": count where is_overdue,
    "awaiting_response": count where hours_awaiting > 24,
    "vip_tickets": count where is_vip,
    "avg_age_days": average days_open,
    "oldest_ticket": max days_open
}
```

## Step 4: Identify Patterns

Use AI to identify patterns and recommendations:

**System Prompt:**
```
You are an IT operations analyst. Review this ticket queue summary and identify:
1. Concerning patterns (e.g., many tickets from same requester, category spikes)
2. Workload risks (e.g., too many P0/P1, approaching burnout)
3. Process improvement suggestions

Be concise and actionable.
```

**User Prompt:**
```
Queue summary:
<stats>
{JSON stats}
</stats>

Ticket list:
<tickets>
{JSON ticket summaries}
</tickets>

Identify patterns and recommendations.
```

## Step 5: Generate Report

```markdown
# SDP Queue Triage Report
*Generated: {timestamp}*
*Technician: sfoley@buxtonco.com*

## Overview

| Metric | Value | Status |
|--------|-------|--------|
| Total Tickets | {total} | - |
| P0 Critical | {p0_count} | {🔴 if > 0 else ✅} |
| P1 High | {p1_count} | {🟡 if > 3 else ✅} |
| Overdue | {overdue} | {🔴 if > 0 else ✅} |
| Awaiting Response 24h+ | {awaiting} | {🔴 if > 0 else ✅} |
| VIP Tickets | {vip} | {🟡 if > 0 else -} |

## Priority Distribution

```
P0 ████░░░░░░ 2 (20%)
P1 ██░░░░░░░░ 1 (10%)
P2 ████████░░ 4 (40%)
P3 ███░░░░░░░ 3 (30%)
```

## Tickets by SDP Priority

| Priority | Count | Avg Age |
|----------|-------|---------|
| Urgent | {count} | {avg} days |
| High | {count} | {avg} days |
| Medium | {count} | {avg} days |
| Low | {count} | {avg} days |

## Attention Required

### Response Gaps (24+ hours)
{List tickets awaiting response with hours waiting}

### VIP Tickets
{List VIP tickets with status}

### Overdue Tickets
{List overdue tickets with days overdue}

## AI Analysis

{Pattern analysis from Step 4}

## Recommendations

{AI recommendations from Step 4}

---

*Run `/sdptriage` to see prioritized ticket list*
```

## Output

Return the formatted report with visual indicators and recommendations.
