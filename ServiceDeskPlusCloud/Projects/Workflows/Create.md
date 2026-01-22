# Create Workflow

Create a new project.

## Input Parameters

- `title` - Project title (required)
- `description` - Project description (optional)
- `start_date` - Start date (optional, default: today)
- `end_date` - Target end date (optional)

## Step 1: Get Credentials

```bash
SDP_API_KEY=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-api-key") | .value')
SDP_BASE_URL=$(bws secret list --output json 2>/dev/null | jq -r '.[] | select(.key == "sdp-base-url") | .value')
```

## Step 2: Create Project

```bash
TITLE="$1"
DESCRIPTION="${2:-$TITLE}"
START_DATE="${3:-$(date +%Y-%m-%d)}"

curl -s -X POST "$SDP_BASE_URL/api/v3/projects" \
  -H "authtoken: $SDP_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "input_data={
    \"project\": {
      \"title\": \"$TITLE\",
      \"description\": \"$DESCRIPTION\",
      \"scheduled_start_time\": {\"value\": \"$START_DATE\"},
      \"owner\": {\"email_id\": \"sfoley@buxtonco.com\"}
    }
  }"
```

## Step 3: Confirm Creation

```markdown
## Project Created

**ID:** 105
**Title:** Q2 Security Hardening Initiative
**Owner:** Seth Foley
**Status:** Not Started

**Next Steps:**
1. Add project description and objectives
2. Define milestones
3. Create tasks
4. Assign team members
5. Set target end date
```

## Notes

- Projects start in "Not Started" status
- Owner is set to current technician
- Add milestones and tasks after creation
- Assign team members for collaboration
