# Milestones Workflow

List milestones for a specific project.

## Input Parameters

- `project_id` - Project ID (required)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query Milestones

```bash
PROJECT_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/projects/$PROJECT_ID/milestones" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 3: Format Output

Present results as:

```markdown
## Project Milestones: Q1 Infrastructure Upgrade

### Timeline View

```
Jan 2026                Feb 2026                Mar 2026
|-------|-------|-------|-------|-------|-------|
    [1]     [2]         [3]             [4]
```

### Milestones

| # | Milestone | Due Date | Status | Progress |
|---|-----------|----------|--------|----------|
| 1 | Hardware Installation | 2026-01-31 | On Track | 80% |
| 2 | Network Migration | 2026-02-15 | At Risk | 30% |
| 3 | Application Migration | 2026-02-28 | Not Started | 0% |
| 4 | Final Testing & Go-Live | 2026-03-31 | Not Started | 0% |

### At Risk: Network Migration
**Due:** 2026-02-15 (26 days remaining)
**Progress:** 30%
**Blockers:**
- Waiting on vendor for equipment delivery
- Change request for firewall rules pending approval

**Mitigation:**
- Escalate equipment order to vendor management
- Request expedited change approval
```

## Notes

- Shows all project milestones chronologically
- Highlights at-risk milestones with details
- Includes progress percentage
- Suggests mitigation for risks
