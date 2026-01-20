---
name: SDPChangeControl
description: ServiceDesk Plus Change Control module. USE WHEN creating change requests, viewing changes, approving changes, change management, OR change control workflows. Invoke with /sdp-change.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SDPChangeControl/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SDPChangeControl (ServiceDesk Plus Change Control)

CLI-first ServiceDesk Plus Change Control management. Token-efficient - loads only when invoked.

## Quick Start

```bash
/sdp-change                    # Show my change requests
/sdp-change pending            # Show pending approvals
/sdp-change create "title"     # Create new change request
/sdp-change approve 12345      # Approve a change
/sdp-change reject 12345       # Reject a change
/sdp-change get 12345          # Get change details
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
| **MyChanges** | "/sdp-change", "my changes", "assigned changes" | `Workflows/MyChanges.md` |
| **Pending** | "pending approvals", "awaiting approval" | `Workflows/Pending.md` |
| **Create** | "create change", "new change request" | `Workflows/Create.md` |
| **Approve** | "approve change", "accept change" | `Workflows/Approve.md` |
| **Reject** | "reject change", "deny change" | `Workflows/Reject.md` |

## API Reference

ServiceDesk Plus Change Control uses REST API v3:

```bash
# Base URL pattern
$SDP_BASE_URL/api/v3/changes

# Authentication header
Authorization: Zoho-oauthtoken $SDP_API_KEY
# OR technician key
authtoken: $SDP_API_KEY
```

### Common Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/changes` | GET | List changes |
| `/api/v3/changes` | POST | Create change |
| `/api/v3/changes/{id}` | GET | Get change details |
| `/api/v3/changes/{id}` | PUT | Update change |
| `/api/v3/changes/{id}/_approve` | POST | Approve change |
| `/api/v3/changes/{id}/_reject` | POST | Reject change |
| `/api/v3/changes/{id}/notes` | POST | Add note to change |
| `/api/v3/changes/{id}/worklogs` | POST | Add worklog |

### Change Types

| Type | Description |
|------|-------------|
| Standard | Pre-approved, low-risk changes |
| Normal | Requires CAB approval |
| Emergency | Urgent changes, expedited process |
| Major | High-risk, extensive planning |

### Change Stages

1. **Submission** - Change request created
2. **Planning** - Impact analysis, rollback plan
3. **Approval** - CAB review (if required)
4. **Implementation** - Change executed
5. **Review** - Post-implementation review
6. **Closure** - Change completed

### Query Parameters

```bash
# Filter by technician (assigned to me)
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"technician.email_id","condition":"is","value":"sfoley@buxtonco.com"}]}}

# Filter pending approval
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"approval_status.name","condition":"is","value":"Pending Approval"}]}}

# Filter by change type
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"change_type.name","condition":"is","value":"Normal"}]}}
```

## Examples

**Example 1: Check my changes**
```
User: "/sdp-change"
-> Queries SDP API for changes assigned to sfoley@buxtonco.com
-> Returns list with ID, title, status, change type
-> Highlights any pending approvals
```

**Example 2: View pending approvals**
```
User: "/sdp-change pending"
-> Queries for changes awaiting approval
-> Shows requester, change type, risk level
-> Indicates CAB meeting date if scheduled
```

**Example 3: Create a change request**
```
User: "/sdp-change create 'Upgrade production database to PostgreSQL 16'"
-> Creates new change request
-> Prompts for: change type, risk, impact, rollback plan
-> Returns change ID and status
```

**Example 4: Approve a change**
```
User: "/sdp-change approve 12345"
-> Approves change request 12345
-> Optionally adds approval comments
-> Returns confirmation with new status
```

**Example 5: Get change details**
```
User: "/sdp-change get 12345"
-> Retrieves full change details
-> Shows: description, impact, rollback plan, approvals
-> Lists associated tasks and worklogs
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired API key | Check `sdp-api-key` in BWS |
| `404 Not Found` | Wrong change ID or URL | Verify change exists, check base URL |
| `403 Forbidden` | No permission for action | Check technician permissions in SDP |
| `400 Bad Request` | Malformed query | Validate JSON input_data format |

## Backend

Uses direct SDP API calls. Credentials stored in BWS.

```bash
# Direct API call pattern
curl -X GET "$SDP_BASE_URL/api/v3/changes" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
