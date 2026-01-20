# MyChanges Workflow

List change requests assigned to the current technician.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query My Changes

```bash
TECHNICIAN="sfoley@buxtonco.com"

curl -s -X GET "$SDP_BASE_URL/api/v3/changes" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"technician.email_id\",\"condition\":\"is\",\"value\":\"$TECHNICIAN\"}]}}"
```

## Step 3: Format Output

Present results as:

```markdown
## My Change Requests

| ID | Title | Type | Status | Scheduled |
|----|-------|------|--------|-----------|
| 12345 | Upgrade PostgreSQL | Normal | Pending Approval | 2026-01-25 |
| 12346 | Patch security vuln | Emergency | In Progress | Today |

**Total:** 2 changes assigned
**Pending Approval:** 1
```

## Notes

- Default technician: `sfoley@buxtonco.com`
- Shows all non-closed changes
- Highlights pending approvals
- Sorts by scheduled date (upcoming first)
