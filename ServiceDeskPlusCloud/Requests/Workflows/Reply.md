# Reply Workflow

Send a reply to a ticket (visible to requester).

## Input Parameters

- `ticket_id` - The SDP request ID
- `reply_content` - The reply message
- `status` (optional) - Update ticket status (e.g., "In Progress", "Resolved")

## Step 1: Get Credentials from BWS

```bash
SDP_API_KEY=$(bws secret get sdp-api-key --output json | jq -r '.value')
SDP_BASE_URL=$(bws secret get sdp-base-url --output json | jq -r '.value')
```

## Step 2: Build Reply Payload

```bash
TICKET_ID="$1"
REPLY_CONTENT="$2"
NEW_STATUS="$3"  # Optional

INPUT_DATA='{
  "reply": {
    "description": "'"$REPLY_CONTENT"'",
    "notify_technician": false
  }
}'
```

## Step 3: Send Reply via API

```bash
curl -s -X POST "$SDP_BASE_URL/api/v3/requests/$TICKET_ID/reply" \
  -H "Authorization: Zoho-oauthtoken $SDP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "input_data=$INPUT_DATA"
```

## Step 4: Update Status (if provided)

If user specified a status change:

```bash
if [ -n "$NEW_STATUS" ]; then
  STATUS_DATA='{
    "request": {
      "status": {
        "name": "'"$NEW_STATUS"'"
      }
    }
  }'

  curl -s -X PUT "$SDP_BASE_URL/api/v3/requests/$TICKET_ID" \
    -H "Authorization: Zoho-oauthtoken $SDP_API_KEY" \
    -H "Content-Type: application/json" \
    -d "input_data=$STATUS_DATA"
fi
```

## Step 5: Verify Success

Check API response for:
- `response_status.status_code` == 2000 (success)
- Requester will receive email notification

## Step 6: Output Confirmation

```
Reply sent to ticket #12345

**To:** john.doe@company.com
**Subject:** RE: Server not responding
**Status:** In Progress (updated)
**Sent at:** 2026-01-19 15:35:00

The requester has been notified via email.
```

## Common Reply Templates

**Acknowledging:**
```
Thank you for reporting this issue. I'm currently investigating and will update you shortly.
```

**Requesting Info:**
```
To help resolve this issue, could you please provide:
1. When did this issue start?
2. Any error messages you're seeing?
3. Has anything changed recently?
```

**Resolved:**
```
This issue has been resolved. [Explanation of fix]. Please let me know if you experience any further problems.
```

**Escalating:**
```
I'm escalating this to our senior team for further investigation. You'll receive an update within [timeframe].
```

## Status Options

Common SDP statuses:
- `Open` - New ticket
- `In Progress` - Being worked on
- `On Hold` - Waiting for external factor
- `Pending` - Waiting for requester
- `Resolved` - Fix implemented
- `Closed` - Confirmed complete

## Output

Return confirmation with delivery timestamp and any status update.
