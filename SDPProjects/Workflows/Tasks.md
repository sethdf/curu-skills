# Tasks Workflow

List all tasks for a specific project.

## Input Parameters

- `project_id` - Project ID (required)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query Project Tasks

```bash
PROJECT_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/projects/$PROJECT_ID/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":100}}"
```

## Step 3: Format Output

Present results as:

```markdown
## Project Tasks: Q1 Infrastructure Upgrade

### In Progress (5)
| ID | Task | Assignee | Due Date | Priority |
|----|------|----------|----------|----------|
| 1001 | Configure new servers | sfoley | 2026-01-25 | High |
| 1002 | Update network ACLs | jsmith | 2026-01-28 | Medium |
| 1003 | Test failover | mbrown | 2026-01-30 | High |
| 1004 | Document procedures | sfoley | 2026-02-01 | Low |
| 1005 | Backup verification | jsmith | 2026-01-26 | High |

### Open (8)
| ID | Task | Assignee | Due Date | Priority |
|----|------|----------|----------|----------|
| 1006 | Migrate databases | sfoley | 2026-02-10 | High |
| ... | ... | ... | ... | ... |

### Completed (11)
- [x] Order new hardware
- [x] Rack and stack servers
- [x] Initial OS installation
- ... (8 more)

**Summary:**
- Total: 24 tasks
- Overdue: 0
- Due this week: 4
```

## Notes

- Groups tasks by status
- Shows assignee and due dates
- Highlights overdue and upcoming tasks
- Useful for sprint planning
