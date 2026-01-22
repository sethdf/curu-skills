# AddNote Workflow

Add an internal note to a ticket (not visible to requester).

## Input Parameters

- `ticket_id` - The SDP request ID
- `note_content` - The note text to add

## Step 1: Get Credentials from BWS

```bash
SDP_API_KEY=$(bws secret get sdp-api-key --output json | jq -r '.value')
SDP_BASE_URL=$(bws secret get sdp-base-url --output json | jq -r '.value')
```

## Step 2: Build Note Payload

```bash
TICKET_ID="$1"
NOTE_CONTENT="$2"

# Notes are internal by default
INPUT_DATA='{
  "request_note": {
    "description": "'"$NOTE_CONTENT"'",
    "show_to_requester": false,
    "notify_technician": false,
    "mark_first_response": false,
    "add_to_linked_requests": false
  }
}'
```

## Step 3: Add Note via API

```bash
curl -s -X POST "$SDP_BASE_URL/api/v3/requests/$TICKET_ID/notes" \
  -H "Authorization: Zoho-oauthtoken $SDP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "input_data=$INPUT_DATA"
```

## Step 4: Verify Success

Check API response for:
- `response_status.status_code` == 2000 (success)
- `request_note.id` exists (note created)

## Step 5: Output Confirmation

```
Note added to ticket #12345

**Note ID:** 67890
**Content:** [truncated preview]
**Added at:** 2026-01-19 15:30:00

Tip: Use `/sdp reply 12345 "message"` to send a response visible to the requester.
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `4005` | Ticket not found | Verify ticket ID exists |
| `4001` | No permission | Check technician access to ticket |
| `5000` | Server error | Retry or check SDP status |

## Note Types

| Type | show_to_requester | Use Case |
|------|-------------------|----------|
| Internal | false | Investigation notes, technical details |
| Public | true | Status updates visible to requester |

## Output

Return confirmation with note ID and timestamp.
