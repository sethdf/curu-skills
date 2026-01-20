---
name: SDPTasks
description: ServiceDesk Plus Tasks module. USE WHEN managing tasks, viewing assigned tasks, creating tasks, updating task status, OR task management. Invoke with /sdp-task.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SDPTasks/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SDPTasks (ServiceDesk Plus Tasks)

CLI-first ServiceDesk Plus Task management. Token-efficient - loads only when invoked.

## Quick Start

```bash
/sdp-task                    # Show my assigned tasks
/sdp-task overdue            # Show overdue tasks
/sdp-task suggest            # Suggest next task to work on
/sdp-task get 12345          # Get task details
/sdp-task complete 12345     # Mark task complete
/sdp-task create "title"     # Create standalone task
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
| **MyTasks** | "/sdp-task", "my tasks", "assigned tasks" | `Workflows/MyTasks.md` |
| **Overdue** | "overdue tasks", "past due tasks" | `Workflows/Overdue.md` |
| **Suggest** | "suggest task", "what task to work on" | `Workflows/Suggest.md` |
| **Complete** | "complete task", "mark done", "finish task" | `Workflows/Complete.md` |
| **Create** | "create task", "new task" | `Workflows/Create.md` |

## Task Types

Tasks in SDP can be:
- **Standalone tasks** - Independent work items
- **Request tasks** - Associated with service requests
- **Project tasks** - Part of a project
- **Change tasks** - Part of a change request

## API Reference

ServiceDesk Plus Tasks uses REST API v3:

```bash
# Base URL pattern
$SDP_BASE_URL/api/v3/tasks

# For request-associated tasks
$SDP_BASE_URL/api/v3/requests/{request_id}/tasks

# Authentication header
Authorization: Zoho-oauthtoken $SDP_API_KEY
# OR technician key
authtoken: $SDP_API_KEY
```

### Common Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/tasks` | GET | List all tasks |
| `/api/v3/tasks` | POST | Create standalone task |
| `/api/v3/tasks/{id}` | GET | Get task details |
| `/api/v3/tasks/{id}` | PUT | Update task |
| `/api/v3/tasks/{id}` | DELETE | Delete task |
| `/api/v3/requests/{id}/tasks` | GET | List request tasks |
| `/api/v3/requests/{id}/tasks` | POST | Create request task |
| `/api/v3/projects/{id}/tasks` | GET | List project tasks |
| `/api/v3/changes/{id}/tasks` | GET | List change tasks |

### Task Status

| Status | Description |
|--------|-------------|
| Open | Task created, not started |
| In Progress | Actively being worked |
| On Hold | Temporarily paused |
| Completed | Task finished |
| Cancelled | Task abandoned |

### Priority Levels

| Priority | Response Time |
|----------|--------------|
| Low | No specific SLA |
| Medium | Standard SLA |
| High | Expedited |
| Urgent | Immediate attention |

### Query Parameters

```bash
# Filter by owner (my tasks)
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"owner.email_id","condition":"is","value":"sfoley@buxtonco.com"}]}}

# Filter overdue tasks
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"due_date","condition":"less than","value":"$CURRENT_TIME"},{"field":"status.name","condition":"is not","value":"Completed"}]}}

# Filter by status
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"status.name","condition":"is","value":"Open"}]}}
```

## Examples

**Example 1: Check my tasks**
```
User: "/sdp-task"
-> Queries SDP API for tasks assigned to sfoley@buxtonco.com
-> Returns list with ID, title, status, due date, parent (request/project/change)
-> Highlights any overdue items
```

**Example 2: View overdue tasks**
```
User: "/sdp-task overdue"
-> Queries for tasks past due date
-> Sorts by oldest first
-> Shows parent item, priority, days overdue
```

**Example 3: Get task details**
```
User: "/sdp-task get 12345"
-> Retrieves full task details
-> Shows: description, assignee, due date, status
-> Indicates parent request/project/change if any
-> Lists any subtasks or dependencies
```

**Example 4: Complete a task**
```
User: "/sdp-task complete 12345"
-> Updates task 12345 status to Completed
-> Optionally adds completion notes
-> Returns confirmation with timestamp
```

**Example 5: Get task suggestion**
```
User: "/sdp-task suggest"
-> Analyzes assigned tasks
-> Considers: priority, due date, parent SLA, dependencies
-> Recommends which task to work on next with reasoning
```

**Example 6: Create a task**
```
User: "/sdp-task create 'Review security audit findings'"
-> Creates new standalone task
-> Prompts for: priority, due date, description
-> Returns task ID and details
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired API key | Check `sdp-api-key` in BWS |
| `404 Not Found` | Wrong task ID or URL | Verify task exists, check base URL |
| `403 Forbidden` | No permission for action | Check technician permissions in SDP |
| `400 Bad Request` | Malformed query | Validate JSON input_data format |

## Backend

Uses direct SDP API calls. Credentials stored in BWS.

```bash
# Direct API call pattern
curl -X GET "$SDP_BASE_URL/api/v3/tasks" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
