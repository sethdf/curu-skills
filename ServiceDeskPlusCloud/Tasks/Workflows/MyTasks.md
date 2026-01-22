# MyTasks Workflow

List tasks assigned to the current technician.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query My Tasks

```bash
TECHNICIAN="sfoley@buxtonco.com"

curl -s -X GET "$SDP_BASE_URL/api/v3/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"owner.email_id\",\"condition\":\"is\",\"value\":\"$TECHNICIAN\"},{\"field\":\"status.name\",\"condition\":\"is not\",\"value\":\"Completed\"}]}}"
```

## Step 3: Format Output

Present results as:

```markdown
## My Tasks

| ID | Task | Parent | Status | Due Date | Priority |
|----|------|--------|--------|----------|----------|
| 1001 | Configure servers | Project: Q1 Upgrade | In Progress | 2026-01-25 | High |
| 1002 | Review security scan | Request #45678 | Open | 2026-01-22 | High |
| 1003 | Update documentation | Standalone | Open | 2026-01-30 | Low |

**Total:** 3 open tasks
**Overdue:** 0
**Due Today:** 1
**High Priority:** 2
```

## Notes

- Default technician: `sfoley@buxtonco.com`
- Shows all non-completed tasks
- Groups by parent type (Project, Request, Change, Standalone)
- Highlights overdue and high priority
