# Complete Workflow

Mark a task as completed.

## Input Parameters

- `task_id` - Task ID (required)
- `notes` - Completion notes (optional)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Get Task Details

First verify the task exists and get context:

```bash
TASK_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/tasks/$TASK_ID" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 3: Update Task Status

```bash
NOTES="${2:-Task completed}"

curl -s -X PUT "$SDP_BASE_URL/api/v3/tasks/$TASK_ID" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"task\": {
      \"status\": {\"name\": \"Completed\"},
      \"completed_time\": {\"value\": \"$(date +%s)000\"}
    }
  }"
```

## Step 4: Add Completion Notes (if provided)

```bash
if [ -n "$NOTES" ]; then
  curl -s -X POST "$SDP_BASE_URL/api/v3/tasks/$TASK_ID/worklogs" \
    -H "authtoken: $SDP_API_KEY" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "input_data={
      \"worklog\": {
        \"description\": \"$NOTES\"
      }
    }"
fi
```

## Step 5: Confirm Completion

```markdown
## Task Completed

**ID:** 1002
**Task:** Review security scan results
**Status:** Completed
**Completed At:** 2026-01-19 21:45:00
**Notes:** Reviewed all findings, no critical issues

**Parent Impact:**
- Request #45678 progress: 75% → 80%
- 2 remaining tasks on parent

**Next Suggested Task:** Update firewall rules (1005)
```

## Notes

- Updates task status to Completed
- Records completion timestamp
- Adds worklog entry with notes
- Shows impact on parent item
- Suggests next task
