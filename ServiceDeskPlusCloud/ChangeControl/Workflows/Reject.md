# Reject Workflow

Reject a change request.

## Input Parameters

- `change_id` - Change request ID (required)
- `reason` - Rejection reason (required)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Review Change Details

First, get change details:

```bash
CHANGE_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/changes/$CHANGE_ID" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 3: Reject Change

```bash
REASON="$2"

curl -s -X POST "$SDP_BASE_URL/api/v3/changes/$CHANGE_ID/_reject" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"approval\": {
      \"comments\": \"$REASON\"
    }
  }"
```

## Step 4: Confirm Rejection

```markdown
## Change Rejected

**ID:** 12345
**Title:** Upgrade PostgreSQL to version 16
**Status:** Rejected
**Rejected By:** sfoley@buxtonco.com
**Reason:** Rollback plan insufficient - please add detailed steps for data recovery

**Next Steps:**
- Technician will be notified
- Change can be resubmitted after addressing concerns
```

## Common Rejection Reasons

- Insufficient rollback plan
- Missing impact analysis
- Scheduling conflict with other changes
- Testing plan not adequate
- Risk too high without mitigation
- Missing stakeholder approval

## Notes

- Always provide constructive feedback
- Suggest what needs to be addressed
- Rejected changes can be resubmitted
