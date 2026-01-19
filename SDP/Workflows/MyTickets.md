# MyTickets Workflow

Retrieve tickets assigned to the current technician (default: sfoley@buxtonco.com).

## Step 1: Get Credentials from BWS

```bash
# Get API key and base URL
SDP_API_KEY=$(bws secret get sdp-api-key --output json | jq -r '.value')
SDP_BASE_URL=$(bws secret get sdp-base-url --output json | jq -r '.value')
```

## Step 2: Build Query

Query for tickets assigned to technician:

```bash
# Default technician email
TECH_EMAIL="sfoley@buxtonco.com"

# Build input_data for filtering
INPUT_DATA='{
  "list_info": {
    "row_count": 50,
    "sort_field": "due_by_time",
    "sort_order": "asc",
    "search_criteria": [
      {
        "field": "technician.email_id",
        "condition": "is",
        "value": "'"$TECH_EMAIL"'"
      },
      {
        "field": "status.name",
        "condition": "is not",
        "values": ["Closed", "Resolved"]
      }
    ]
  }
}'
```

## Step 3: Query SDP API

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/requests" \
  -H "Authorization: Zoho-oauthtoken $SDP_API_KEY" \
  -H "Content-Type: application/json" \
  --data-urlencode "input_data=$INPUT_DATA"
```

## Step 4: Format Output

Present tickets in a clear format:

| ID | Subject | Status | Priority | Due Date | Requester |
|----|---------|--------|----------|----------|-----------|
| ... | ... | ... | ... | ... | ... |

**Highlight:**
- Overdue tickets in RED
- High priority tickets with indicator
- VIP requesters with indicator

## Step 5: Summary

Provide summary stats:
- Total open tickets: X
- Overdue: X (list IDs)
- High priority: X
- Due today: X

## Output

Return formatted ticket list with actionable insights.
