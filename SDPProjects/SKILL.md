---
name: SDPProjects
description: ServiceDesk Plus Projects module. USE WHEN managing projects, viewing project tasks, project milestones, project timelines, OR IT project management. Invoke with /sdp-project.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SDPProjects/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SDPProjects (ServiceDesk Plus Projects)

CLI-first ServiceDesk Plus Project management. Token-efficient - loads only when invoked.

## Quick Start

```bash
/sdp-project                     # Show my projects
/sdp-project list                # List all active projects
/sdp-project get 12345           # Get project details
/sdp-project tasks 12345         # List project tasks
/sdp-project milestones 12345    # Show project milestones
/sdp-project create "title"      # Create new project
```

## Zone Awareness

**SDP is a work-only tool.** The auth-keeper backend will warn if `$ZONE != work`.

To ensure proper zone context:
- Work from `/data/work/` directory (sets `ZONE=work` via direnv)
- Or set `export ZONE=work` manually

## Configuration

**Default technician email:** `sfoley@buxtonco.com`

**API credentials in BWS:**
- `sdp-api-key` - ServiceDesk Plus API key
- `sdp-base-url` - SDP instance URL (e.g., `https://sdpondemand.manageengine.com`)

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **MyProjects** | "/sdp-project", "my projects", "assigned projects" | `Workflows/MyProjects.md` |
| **List** | "list projects", "all projects" | `Workflows/List.md` |
| **Details** | "project details", "get project" | `Workflows/Details.md` |
| **Tasks** | "project tasks", "tasks in project" | `Workflows/Tasks.md` |
| **Milestones** | "project milestones", "deadlines" | `Workflows/Milestones.md` |
| **Create** | "create project", "new project" | `Workflows/Create.md` |

## API Reference

ServiceDesk Plus Projects uses REST API v3:

```bash
# Base URL pattern
$SDP_BASE_URL/api/v3/projects

# Authentication header
Authorization: Zoho-oauthtoken $SDP_API_KEY
# OR technician key
authtoken: $SDP_API_KEY
```

### Common Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/projects` | GET | List projects |
| `/api/v3/projects` | POST | Create project |
| `/api/v3/projects/{id}` | GET | Get project details |
| `/api/v3/projects/{id}` | PUT | Update project |
| `/api/v3/projects/{id}/tasks` | GET | List project tasks |
| `/api/v3/projects/{id}/tasks` | POST | Create project task |
| `/api/v3/projects/{id}/milestones` | GET | List milestones |
| `/api/v3/projects/{id}/milestones` | POST | Create milestone |
| `/api/v3/projects/{id}/members` | GET | List project members |

### Project Status

| Status | Description |
|--------|-------------|
| Not Started | Project created but not begun |
| In Progress | Active project work |
| On Hold | Temporarily paused |
| Completed | All tasks finished |
| Cancelled | Project abandoned |

### Query Parameters

```bash
# Filter by owner (my projects)
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"owner.email_id","condition":"is","value":"sfoley@buxtonco.com"}]}}

# Filter active projects
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"status.name","condition":"is","value":"In Progress"}]}}

# Filter by due date
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"scheduled_end_time","condition":"less than","value":"$DATE"}]}}
```

## Examples

**Example 1: Check my projects**
```
User: "/sdp-project"
-> Queries SDP API for projects owned by sfoley@buxtonco.com
-> Returns list with ID, title, status, progress %
-> Highlights any overdue milestones
```

**Example 2: View project details**
```
User: "/sdp-project get 12345"
-> Retrieves full project details
-> Shows: description, timeline, budget, team members
-> Lists tasks and milestones summary
```

**Example 3: List project tasks**
```
User: "/sdp-project tasks 12345"
-> Lists all tasks in project 12345
-> Shows: task name, assignee, status, due date
-> Indicates dependencies and blockers
```

**Example 4: View milestones**
```
User: "/sdp-project milestones 12345"
-> Lists all milestones for project 12345
-> Shows: milestone name, due date, status
-> Highlights upcoming or overdue milestones
```

**Example 5: Create a new project**
```
User: "/sdp-project create 'Q1 Infrastructure Upgrade'"
-> Creates new project
-> Prompts for: timeline, team, milestones
-> Returns project ID and details
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired API key | Check `sdp-api-key` in BWS |
| `404 Not Found` | Wrong project ID or URL | Verify project exists, check base URL |
| `403 Forbidden` | No permission for action | Check technician permissions in SDP |
| `400 Bad Request` | Malformed query | Validate JSON input_data format |

## Backend

Uses direct SDP API calls. Credentials stored in BWS.

```bash
# Direct API call pattern
curl -X GET "$SDP_BASE_URL/api/v3/projects" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
