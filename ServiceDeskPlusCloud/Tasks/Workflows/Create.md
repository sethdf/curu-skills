# Create Workflow

Create a new standalone task.

## Input Parameters

- `title` - Task title (required)
- `description` - Task description (optional)
- `due_date` - Due date (optional)
- `priority` - Low, Medium, High, Urgent (optional, default: Medium)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Create Task

```bash
TITLE="$1"
DESCRIPTION="${2:-$TITLE}"
PRIORITY="${3:-Medium}"

curl -s -X POST "$SDP_BASE_URL/api/v3/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"task\": {
      \"title\": \"$TITLE\",
      \"description\": \"$DESCRIPTION\",
      \"priority\": {\"name\": \"$PRIORITY\"},
      \"status\": {\"name\": \"Open\"},
      \"owner\": {\"email_id\": \"sfoley@buxtonco.com\"}
    }
  }"
```

## Step 3: Confirm Creation

```markdown
## Task Created

**ID:** 1020
**Title:** Review quarterly security metrics
**Status:** Open
**Priority:** Medium
**Owner:** Seth Foley

**Task is standalone** (not linked to request, project, or change)

**To link to parent:**
- Use SDP web UI to associate with request/project/change
- Or create task via parent item's API endpoint
```

## Creating Linked Tasks

### Link to Request
```bash
curl -s -X POST "$SDP_BASE_URL/api/v3/requests/{request_id}/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  --data-urlencode "input_data={...}"
```

### Link to Project
```bash
curl -s -X POST "$SDP_BASE_URL/api/v3/projects/{project_id}/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  --data-urlencode "input_data={...}"
```

### Link to Change
```bash
curl -s -X POST "$SDP_BASE_URL/api/v3/changes/{change_id}/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  --data-urlencode "input_data={...}"
```

## Notes

- Default creates standalone task
- To create linked task, use parent's endpoint
- Owner defaults to current technician
