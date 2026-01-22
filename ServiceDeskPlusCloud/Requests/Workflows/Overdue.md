# Overdue Workflow

List tickets that are past their due date.

## Step 1: Get Credentials from BWS

```bash
SDP_API_KEY=$(bws secret get sdp-api-key --output json | jq -r '.value')
SDP_BASE_URL=$(bws secret get sdp-base-url --output json | jq -r '.value')
```

## Step 2: Get Current Timestamp

```bash
# Current time in milliseconds (SDP uses epoch ms)
CURRENT_TIME=$(date +%s)000
```

## Step 3: Build Query for Overdue Tickets

```bash
TECH_EMAIL="sfoley@buxtonco.com"

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
        "field": "due_by_time",
        "condition": "less than",
        "value": "'"$CURRENT_TIME"'"
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

## Step 4: Query SDP API

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/requests" \
  -H "Authorization: Zoho-oauthtoken $SDP_API_KEY" \
  -H "Content-Type: application/json" \
  --data-urlencode "input_data=$INPUT_DATA"
```

## Step 5: Calculate Days Overdue

For each ticket, calculate:
```
days_overdue = (current_time - due_by_time) / (24 * 60 * 60 * 1000)
```

## Step 6: Format Output

| ID | Subject | Days Overdue | Priority | Requester | Last Updated |
|----|---------|--------------|----------|-----------|--------------|
| ... | ... | ... | ... | ... | ... |

Sort by most overdue first.

## Step 7: Recommendations

For severely overdue tickets (>7 days), suggest:
- Escalation to manager
- Status update to requester
- Closure if abandoned

## Output

Return prioritized list of overdue tickets with recommended actions.
