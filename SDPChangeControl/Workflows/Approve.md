# Approve Workflow

Approve a change request.

## Input Parameters

- `change_id` - Change request ID (required)
- `comments` - Approval comments (optional)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Review Change Details

First, get change details for review:

```bash
CHANGE_ID="$1"

curl -s -X GET "$SDP_BASE_URL/api/v3/changes/$CHANGE_ID" \
  -H "authtoken: $SDP_API_KEY"
```

## Step 3: Approve Change

```bash
COMMENTS="${2:-Approved}"

curl -s -X POST "$SDP_BASE_URL/api/v3/changes/$CHANGE_ID/_approve" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"approval\": {
      \"comments\": \"$COMMENTS\"
    }
  }"
```

## Step 4: Confirm Approval

```markdown
## Change Approved

**ID:** 12345
**Title:** Upgrade PostgreSQL to version 16
**Status:** Approved
**Approved By:** sfoley@buxtonco.com
**Comments:** Approved - rollback plan looks solid

**Next Steps:**
- Change is now ready for implementation
- Technician will be notified
```

## Notes

- Review impact analysis before approving
- Verify rollback plan is documented
- Check scheduled time is appropriate
- Consider dependencies and affected systems
