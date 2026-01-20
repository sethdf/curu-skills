# Details Workflow

Get detailed information about a specific project.

## Input Parameters

- `project_id` - Project ID (required)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Get Project Details

```bash
PROJECT_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/projects/$PROJECT_ID" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 3: Get Project Tasks Summary

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/projects/$PROJECT_ID/tasks" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 4: Get Milestones

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/projects/$PROJECT_ID/milestones" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 5: Format Output

Present results as:

```markdown
## Project: Q1 Infrastructure Upgrade

**ID:** 101
**Status:** In Progress
**Owner:** Seth Foley
**Progress:** 45%

### Timeline
- **Start Date:** 2026-01-01
- **Due Date:** 2026-03-31
- **Days Remaining:** 71

### Description
Upgrade core infrastructure components including servers, network equipment, and storage systems to support increased capacity requirements.

### Team Members
| Name | Role |
|------|------|
| Seth Foley | Owner |
| John Smith | Lead Engineer |
| Mary Brown | QA |

### Tasks Summary
- **Total:** 24 tasks
- **Completed:** 11 (45%)
- **In Progress:** 5
- **Open:** 8

### Upcoming Milestones
| Milestone | Due Date | Status |
|-----------|----------|--------|
| Server hardware installed | 2026-01-31 | On Track |
| Network migration complete | 2026-02-15 | At Risk |
| Final testing | 2026-03-15 | Not Started |
```

## Notes

- Shows comprehensive project overview
- Includes task and milestone summaries
- Highlights at-risk milestones
- Lists all team members with roles
