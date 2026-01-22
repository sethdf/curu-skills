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
You are an IT helpdesk triage specialist. Analyze these ServiceDesk Plus tickets and categorize each by priority tier.

Priority Tiers:
- P0 Critical: Requires immediate attention. Overdue + VIP, or 48+ hours awaiting response, or business-critical impact.
- P1 High: Handle today. Overdue, or VIP requester, or 24+ hours awaiting response, or high priority.
- P2 Medium: Handle this week. Due soon, aging tickets, medium priority.
- P3 Low: Handle when able. On track, low priority, no urgency signals.

Consider:
1. Response gaps (time since requester last messaged without tech response) - CRITICAL factor
2. VIP status and requester seniority
3. Overdue status and time overdue
4. Original priority and how long ignored
5. Patterns suggesting escalation risk

Output JSON array with:
{
  "ticket_id": "...",
  "tier": "P0|P1|P2|P3",
  "reasoning": "Brief explanation of why this tier",
  "suggested_action": "What to do next"
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

Present results grouped by tier:

```markdown
# Ticket Triage Report
*Generated: {timestamp}*
*Tickets analyzed: {count}*

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
| #12360 | Software request | 2 | On track, low priority |

---

## Summary Statistics

- **P0 Critical:** 2 tickets
- **P1 High:** 1 ticket
- **P2 Medium:** 1 ticket
- **P3 Low:** 1 ticket
- **Total:** 5 tickets

**Response Gap Alert:** 3 tickets awaiting your response 24+ hours
```

## Output

Return the formatted triage report. Offer to take action on P0 tickets immediately.
