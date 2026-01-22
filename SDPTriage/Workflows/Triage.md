# Triage Workflow

AI-powered ticket prioritization for assigned SDP tickets.

## Step 1: Fetch Assigned Tickets

Use auth-keeper to get all tickets assigned to me:

```bash
auth-keeper sdp
```

This returns tickets in JSON format with fields:
- `id` - Ticket ID
- `subject` - Ticket subject
- `status` - Current status
- `priority` - Priority level (Urgent/High/Medium/Low)
- `due_by_time` - Due date/time
- `created_time` - When ticket was created
- `technician` - Assigned technician
- `requester` - Who opened the ticket
- `last_updated_time` - Last activity

## Step 2: Enrich With Response Data

For each ticket, check if I've responded:

```bash
auth-keeper sdp get <ticket_id>
```

Extract from ticket details:
- **My last response time** - When I last replied/noted
- **Requester's last message time** - When they last messaged
- **Response gap** - Time since requester messaged without my reply
- **VIP status** - If requester is VIP
- **Requester role** - Job title/department if available

## Step 3: Calculate Base Metrics

For each ticket, compute:

```python
metrics = {
    "ticket_id": id,
    "subject": subject,
    "days_open": (now - created_time).days,
    "days_since_my_response": (now - my_last_response).days if my_last_response else None,
    "hours_awaiting_response": hours since requester messaged without my reply,
    "is_overdue": due_by_time < now,
    "days_overdue": max(0, (now - due_by_time).days),
    "priority": priority,
    "is_vip": requester.is_vip,
    "requester_role": requester.role or "unknown"
}
```

## Step 4: AI Prioritization

Use PAI Inference to categorize each ticket. Batch tickets for efficiency.

**System Prompt:**
```
You are an IT helpdesk triage specialist. Analyze these ServiceDesk Plus tickets and categorize each by:
1. Priority tier (P0-P3)
2. Quick Win potential (separate from priority)

Priority Tiers:
- P0 Critical: Requires immediate attention. Overdue + VIP, or 48+ hours awaiting response, or business-critical impact.
- P1 High: Handle today. Overdue, or VIP requester, or 24+ hours awaiting response, or high priority.
- P2 Medium: Handle this week. Due soon, aging tickets, medium priority.
- P3 Low: Handle when able. On track, low priority, no urgency signals.

Quick Win Indicators (can be any priority tier):
- Simple requests: password resets, access grants, info requests
- Known solutions: common issues with documented fixes
- Low complexity: single action resolves it
- Fast turnaround: can close in under 15 minutes
- Clear path: obvious next step, no investigation needed

Consider:
1. Response gaps (time since requester last messaged without tech response) - CRITICAL factor
2. VIP status and requester seniority
3. Overdue status and time overdue
4. Original priority and how long ignored
5. Patterns suggesting escalation risk
6. Ticket subject/description suggesting simple vs complex issue

Output JSON array with:
{
  "ticket_id": "...",
  "tier": "P0|P1|P2|P3",
  "quick_win": true|false,
  "quick_win_reason": "Why this is/isn't a quick win (if quick_win is true)",
  "reasoning": "Brief explanation of priority tier",
  "suggested_action": "What to do next",
  "estimated_time": "5min|15min|30min|1hr|2hr+"
}
```

**User Prompt:**
```
Triage these tickets:

<tickets>
[JSON array of ticket metrics]
</tickets>

Return prioritized categorization.
```

**Execute:**
```bash
bun ~/.claude/skills/CORE/Tools/Inference.ts \
  --level standard \
  --json \
  "$SYSTEM_PROMPT" \
  "$USER_PROMPT"
```

## Step 5: Generate Output

Present results with Quick Wins highlighted, then grouped by tier:

```markdown
# Ticket Triage Report
*Generated: {timestamp}*
*Tickets analyzed: {count}*

---

## Quick Wins (Clear These Fast)

These tickets can be resolved quickly for momentum:

| ID | Subject | Est. Time | Tier | Why Quick |
|----|---------|-----------|------|-----------|
| #12360 | Password reset | 5min | P2 | Standard reset, known process |
| #12365 | Access request | 15min | P3 | Simple group add in AD |

**Quick Win Strategy:** Knock these out first for visible progress, then focus on P0/P1.

---

## P0 - Critical (Handle Immediately)

| ID | Subject | Days Open | Awaiting Response | Reason |
|----|---------|-----------|-------------------|--------|
| #12345 | Server down | 3 | 52 hours | VIP (CFO), overdue, no response |
| #12346 | Email broken | 2 | 36 hours | Overdue, high priority |

**Suggested Actions:**
- #12345: Call CFO directly, escalate to manager if needed
- #12346: Check mail server logs, update within 1 hour

---

## P1 - High (Handle Today)

| ID | Subject | Days Open | Awaiting Response | Reason |
|----|---------|-----------|-------------------|--------|
| #12347 | Login issues | 1 | 28 hours | VIP requester, response gap |

---

## P2 - Medium (This Week)

| ID | Subject | Days Open | Due In | Reason |
|----|---------|-----------|--------|--------|
| #12350 | Printer setup | 4 | 2 days | Standard aging ticket |

---

## P3 - Low (When Able)

| ID | Subject | Days Open | Status |
|----|---------|-----------|--------|
| #12361 | Software request | 2 | On track, low priority |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **P0 Critical** | 2 |
| **P1 High** | 1 |
| **P2 Medium** | 1 |
| **P3 Low** | 2 |
| **Total** | 6 |
| **Quick Wins** | 2 |

**Alerts:**
- Response Gap (24h+): 3 tickets
- Quick Wins Available: 2 tickets (~20min total)
```

## Output

Return the formatted triage report with Quick Wins section first (for easy clearing), then priority tiers. Offer to:
1. Handle Quick Wins first for momentum
2. Take immediate action on P0 tickets
