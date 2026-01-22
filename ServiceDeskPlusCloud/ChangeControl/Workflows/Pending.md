# Pending Workflow

List changes pending approval.

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Query Pending Changes

```bash
curl -s -X GET "$SDP_BASE_URL/api/v3/changes" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={\"list_info\":{\"row_count\":50,\"search_criteria\":[{\"field\":\"approval_status.name\",\"condition\":\"is\",\"value\":\"Pending Approval\"}]}}"
```

## Step 3: Format Output

Present results as:

```markdown
## Pending Approvals

| ID | Title | Requester | Type | Risk | CAB Date |
|----|-------|-----------|------|------|----------|
| 12345 | DB Upgrade | jsmith | Normal | Medium | 2026-01-22 |
| 12346 | Server Migration | mbrown | Major | High | 2026-01-25 |

**Total Pending:** 2 changes awaiting approval
```

## Notes

- Shows changes I need to approve
- Also shows changes I submitted awaiting approval
- Indicates CAB meeting date if scheduled
- Risk level helps prioritize review
