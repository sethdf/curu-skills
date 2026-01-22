# Overdue Workflow

List overdue tasks.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query Overdue Tasks

```bash
TECHNICIAN="sfoley@buxtonco.com"
NOW=$(date +%s)000  # Current time in milliseconds

curl -s -X GET "$SDP_BASE_URL/api/v3/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"owner.email_id\",\"condition\":\"is\",\"value\":\"$TECHNICIAN\"},{\"field\":\"due_date\",\"condition\":\"less than\",\"value\":\"$NOW\"},{\"field\":\"status.name\",\"condition\":\"is not\",\"value\":\"Completed\"}]}}"
```

## Step 3: Format Output

Present results sorted by most overdue first:

```markdown
## Overdue Tasks

| ID | Task | Parent | Due Date | Days Overdue | Priority |
|----|------|--------|----------|--------------|----------|
| 1002 | Review security scan | Request #45678 | 2026-01-15 | 4 days | High |
| 1005 | Update firewall rules | Change #789 | 2026-01-17 | 2 days | High |
| 1008 | Test backup restore | Standalone | 2026-01-18 | 1 day | Medium |

**Total Overdue:** 3 tasks
**Critical (>7 days):** 0
**Action Required:** Address high priority tasks first
```

## Notes

- Sorts by most overdue first
- Shows parent item context
- Highlights critical overdue (>7 days)
- Consider impact on parent SLAs
