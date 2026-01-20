# MyProjects Workflow

List projects owned or assigned to the current technician.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query My Projects

```bash
TECHNICIAN="sfoley@buxtonco.com"

curl -s -X GET "$SDP_BASE_URL/api/v3/projects" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"owner.email_id\",\"condition\":\"is\",\"value\":\"$TECHNICIAN\"}]}}"
```

## Step 3: Format Output

Present results as:

```markdown
## My Projects

| ID | Title | Status | Progress | Due Date |
|----|-------|--------|----------|----------|
| 101 | Q1 Infrastructure Upgrade | In Progress | 45% | 2026-03-31 |
| 102 | Security Audit Remediation | In Progress | 20% | 2026-02-28 |
| 103 | Legacy System Migration | Not Started | 0% | 2026-06-30 |

**Total:** 3 projects
**In Progress:** 2
**At Risk:** 0
```

## Notes

- Default technician: `sfoley@buxtonco.com`
- Shows owned projects and projects where assigned as member
- Progress calculated from completed tasks
- Highlights projects at risk (overdue milestones)
