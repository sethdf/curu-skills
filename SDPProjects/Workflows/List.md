# List Workflow

List all active projects.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query Active Projects

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/projects" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":100,\"search_criteria\":[{\"field\":\"status.name\",\"condition\":\"is not\",\"value\":\"Completed\"},{\"field\":\"status.name\",\"condition\":\"is not\",\"value\":\"Cancelled\"}]}}"
```

## Step 3: Format Output

Present results as:

```markdown
## Active Projects

| ID | Title | Owner | Status | Progress | Due Date |
|----|-------|-------|--------|----------|----------|
| 101 | Q1 Infrastructure Upgrade | sfoley | In Progress | 45% | 2026-03-31 |
| 102 | Security Audit Remediation | jsmith | In Progress | 20% | 2026-02-28 |
| 103 | Legacy System Migration | mbrown | Not Started | 0% | 2026-06-30 |
| 104 | Network Refresh | sfoley | On Hold | 60% | TBD |

**Total Active:** 4 projects
**In Progress:** 2
**On Hold:** 1
**Not Started:** 1
```

## Notes

- Excludes completed and cancelled projects
- Shows all org projects (not just mine)
- Useful for capacity planning and resource allocation
