# Create Workflow

Create a new change request.

## Input Parameters

- `title` - Change request title (required)
- `change_type` - Standard, Normal, Emergency, Major (optional, default: Normal)
- `description` - Detailed description (optional)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Create Change Request

```bash
TITLE="$1"
DESCRIPTION="${2:-$TITLE}"
CHANGE_TYPE="${3:-Normal}"

curl -s -X POST "$SDP_BASE_URL/api/v3/changes" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"change\": {
      \"title\": \"$TITLE\",
      \"description\": \"$DESCRIPTION\",
      \"change_type\": {\"name\": \"$CHANGE_TYPE\"},
      \"technician\": {\"email_id\": \"sfoley@buxtonco.com\"}
    }
  }"
```

## Step 3: Confirm Creation

Parse response to get change ID and status:

```markdown
## Change Request Created

**ID:** 12347
**Title:** Upgrade PostgreSQL to version 16
**Type:** Normal
**Status:** Submitted

**Next Steps:**
1. Add impact analysis
2. Document rollback plan
3. Submit for approval
```

## Required Fields for Approval

Before submitting for approval, ensure:
- [ ] Impact analysis completed
- [ ] Rollback plan documented
- [ ] Testing plan defined
- [ ] Scheduled implementation time set
- [ ] Affected CIs identified

## Notes

- Normal changes require CAB approval
- Emergency changes have expedited approval
- Standard changes are pre-approved templates
- Major changes need extensive planning
