---
name: SDP
description: ServiceDesk Plus ticket management. USE WHEN checking tickets, viewing overdue tickets, adding notes to tickets, replying to tickets, OR managing SDP helpdesk requests. Invoke with /sdp.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SDP/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SDP (ServiceDesk Plus)

CLI-first ServiceDesk Plus ticket management. Token-efficient - loads only when invoked.

## Quick Start

```bash
/sdp                         # Show my assigned tickets
/sdp overdue                 # Show overdue tickets
/sdp suggest                 # Suggest next ticket to work on
/sdp note 12345 "findings"   # Add note to ticket
/sdp reply 12345 "response"  # Reply to ticket
```

## Configuration

**Default technician email:** `sfoley@buxtonco.com`

**API credentials in BWS:**
- `sdp-api-key` - ServiceDesk Plus API key
- `sdp-base-url` - SDP instance URL (e.g., `https://sdpondemand.manageengine.com`)

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **MyTickets** | "/sdp", "my tickets", "assigned tickets" | `Workflows/MyTickets.md` |
| **Overdue** | "overdue tickets", "past due" | `Workflows/Overdue.md` |
| **Suggest** | "suggest ticket", "what to work on" | `Workflows/Suggest.md` |
| **AddNote** | "add note", "document findings" | `Workflows/AddNote.md` |
| **Reply** | "reply to ticket", "respond to ticket" | `Workflows/Reply.md` |

## API Reference

ServiceDesk Plus uses REST API v3:

```bash
# Base URL pattern
$SDP_BASE_URL/api/v3/requests

# Authentication header
Authorization: Zoho-oauthtoken $SDP_API_KEY
# OR technician key
authtoken: $SDP_API_KEY
```

### Common Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v3/requests` | GET | List requests |
| `/api/v3/requests/{id}` | GET | Get request details |
| `/api/v3/requests/{id}/notes` | POST | Add note |
| `/api/v3/requests/{id}/reply` | POST | Send reply |

### Query Parameters

```bash
# Filter by technician (assigned to me)
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"technician.email_id","condition":"is","value":"sfoley@buxtonco.com"}]}}

# Filter overdue
input_data={"list_info":{"row_count":50,"search_criteria":[{"field":"due_by_time","condition":"less than","value":"$CURRENT_TIME"}]}}
```

## Examples

**Example 1: Check my tickets**
```
User: "/sdp"
-> Queries SDP API for tickets assigned to sfoley@buxtonco.com
-> Returns list with ID, subject, status, due date
-> Highlights any overdue items
```

**Example 2: Work on overdue tickets**
```
User: "/sdp overdue"
-> Queries for tickets past due date
-> Sorts by oldest first
-> Shows requester, priority, days overdue
```

**Example 3: Add investigation notes**
```
User: "/sdp note 12345 'Investigated root cause - DNS resolution failure on prod-web-03'"
-> Adds internal note to ticket 12345
-> Note is not visible to requester
-> Returns confirmation
```

**Example 4: Reply to requester**
```
User: "/sdp reply 12345 'Issue has been resolved. The DNS cache was cleared.'"
-> Sends reply visible to requester
-> Optionally updates ticket status
-> Returns confirmation with timestamp
```

**Example 5: Get ticket suggestion**
```
User: "/sdp suggest"
-> Analyzes assigned tickets
-> Considers: priority, due date, requester VIP status
-> Recommends which ticket to work on next with reasoning
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired API key | Check `sdp-api-key` in BWS |
| `404 Not Found` | Wrong ticket ID or URL | Verify ticket exists, check base URL |
| `403 Forbidden` | No permission for action | Check technician permissions in SDP |
| `400 Bad Request` | Malformed query | Validate JSON input_data format |

## Backend

Uses `auth-keeper sdp` for all operations. Credentials stored in BWS.

```bash
# Via auth-keeper
auth-keeper sdp                     # List my tickets
auth-keeper sdp overdue             # Overdue tickets
auth-keeper sdp get 12345           # Ticket details
auth-keeper sdp note 12345 "msg"    # Add note
auth-keeper sdp reply 12345 "msg"   # Reply to requester
auth-keeper sdp auth                # Test connection
```
