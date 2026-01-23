# ViewTicket Workflow

View a single ticket by display ID and automatically prompt for pickup if unassigned.

## Triggers

- "ticket 42376"
- "work on ticket 42376"
- "let's work on ticket 42376"
- "/sdp 42376"
- "show me ticket 42376"

## Step 1: Fetch Ticket Details

Use the ViewTicket tool with JSON output:

```bash
bun Tools/ViewTicket.ts <ticket_id> --json
```

This returns:
```json
{
  "ticket_id": "42376",
  "internal_id": "55354000036864001",
  "subject": "PybuxSql Service Account Permissions",
  "status": "Open",
  "in_progress": true,
  "is_assigned_to_me": false,
  "is_unassigned": true,
  "requires_pickup": true,
  "pickup_suggestion": "Ticket is unassigned. Prompt user if they want to pick it up."
}
```

## Step 2: Present Ticket Info

Display ticket details in a clear format:

| Field | Value |
|-------|-------|
| Ticket | #42376 |
| Subject | ... |
| Status | Open (In Progress) |
| Priority | Normal |
| Technician | ⚠️ UNASSIGNED / ✅ You / Someone Else |
| Due | Jan 28, 2026 |
| Requester | Name (email) |

Include requester department, job title, and CC list if present.

## Step 3: Check Assignment Status

Evaluate these flags from JSON output:

| Flag | Meaning |
|------|---------|
| `is_assigned_to_me` | Ticket is already assigned to you |
| `is_unassigned` | No technician assigned |
| `requires_pickup` | Action needed (unassigned or assigned to others) |
| `in_progress` | Ticket is in working state |

## Step 4: Prompt for Pickup (if needed)

**If `requires_pickup` is true**, use AskUserQuestion:

```
Question: "Would you like to pick up ticket #42376?"
Options:
  - "Yes, assign to me" (Recommended)
  - "No, just viewing"
```

## Step 5: Execute Pickup (if requested)

If user confirms pickup:

```bash
bun Tools/ViewTicket.ts <ticket_id> --pickup
```

Or via direct API:
```bash
source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
_ak_sdp_api "PUT" "/api/v3/requests/<internal_id>/pickup"
```

## Step 6: Confirm Result

After pickup, display updated status:

```
✅ Ticket #42376 assigned to Seth Foley
Status: Open (In Progress)
Assigned: Jan 23, 2026 10:29 AM
```

## Output Format

Present ticket with clear visual indicators:
- ⚠️ Yellow warning for unassigned
- ✅ Green check if assigned to you
- 🔴 Red if overdue
- ⭐ Star for VIP requesters

Always include:
1. Full ticket details
2. Assignment status
3. Action prompt if pickup needed
4. Description/request content
