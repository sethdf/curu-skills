# Suggest Workflow

Analyze assigned tasks and suggest which to work on next.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query All Open Tasks

```bash
TECHNICIAN="sfoley@buxtonco.com"

curl -s -X GET "$SDP_BASE_URL/api/v3/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"owner.email_id\",\"condition\":\"is\",\"value\":\"$TECHNICIAN\"},{\"field\":\"status.name\",\"condition\":\"is not\",\"value\":\"Completed\"}]}}"
```

## Step 3: Analyze and Score

Score each task based on:
- **Overdue status** (+30 points if overdue)
- **Priority** (Urgent: +25, High: +20, Medium: +10, Low: +5)
- **Due date proximity** (+20 if due within 24h, +10 if within 3 days)
- **Parent SLA impact** (+15 if parent request has SLA breach risk)
- **Dependencies** (+10 if blocking other tasks)
- **Effort estimate** (quick wins get +5)

## Step 4: Format Recommendation

```markdown
## Task Suggestion

### Recommended: Review security scan results
**Task ID:** 1002
**Parent:** Request #45678 - Security Audit Follow-up
**Priority:** High
**Due:** 2026-01-22 (in 3 days)

**Why this task:**
1. High priority with approaching deadline
2. Parent request has SLA (4 days remaining)
3. Quick task (~30 min estimated)
4. Blocks: Change request for remediation

### Alternative Options

| Rank | Task | Reason | Est. Time |
|------|------|--------|-----------|
| 2 | Update firewall rules | Overdue by 1 day | 2 hrs |
| 3 | Configure servers | High priority, project task | 4 hrs |
| 4 | Update documentation | Low priority, no deadline | 1 hr |

### Quick Wins (< 30 min)
- [ ] Review security scan (1002)
- [ ] Approve change request (1010)
- [ ] Update ticket status (1015)
```

## Notes

- Considers parent item context
- Weighs SLA impact
- Identifies quick wins
- Accounts for dependencies
