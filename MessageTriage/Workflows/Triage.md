# Triage Workflow

**Complete end-to-end message triage: Export → Categorize → Report → Apply**

This is the main workflow that orchestrates the full triage process.

## Prerequisites

- `auth-keeper` configured for MS365 (email)
- `slackdump` configured (Slack)
- `sqlite3` available
- PAI Inference tool: `~/.claude/tools/Inference.ts`

## Step 1: Detect Source

Determine message source from user request:

| User Says | Source | Adapter |
|-----------|--------|---------|
| "inbox", "email", "ms365", "outlook" | `email` | MS365 Graph API |
| "#channel", "slack", "channel" | `slack` | Slackdump SQLite |
| Default (no specification) | `email` | MS365 Graph API |

## Step 2: Export Messages

### For Email (MS365)

```bash
zsh -ic 'auth-keeper ms365 "
  \$inbox = Get-MgUserMailFolder -UserId \"sfoley@buxtonco.com\" | Where-Object { \$_.DisplayName -eq \"Inbox\" }
  Get-MgUserMailFolderMessage -UserId \"sfoley@buxtonco.com\" -MailFolderId \$inbox.Id -Filter \"isRead eq false\" -Top 100 -Select \"id,subject,from,receivedDateTime,bodyPreview,conversationId\" | ConvertTo-Json
"'
```

Store results in working memory for categorization.

### For Slack

```bash
# Sync latest messages
slackdump resume ~/slack-archive/

# Query recent messages
sqlite3 ~/slack-archive/slackdump.sqlite "
  SELECT
    m.ts AS id,
    datetime(CAST(m.ts AS REAL), 'unixepoch') AS timestamp,
    u.real_name AS from_name,
    c.name AS channel,
    substr(m.text, 1, 500) AS body
  FROM MESSAGE m
  LEFT JOIN S_USER u ON m.user = u.id
  LEFT JOIN CHANNEL c ON m.channel_id = c.id
  WHERE datetime(CAST(m.ts AS REAL), 'unixepoch') > datetime('now', '-7 days')
  ORDER BY m.ts DESC
  LIMIT 100;
"
```

## Step 3: Gather Thread Context

For each message, retrieve thread context per `ThreadContext.md`:

### Email Thread Context

```bash
zsh -ic 'auth-keeper ms365 "
  Get-MgUserMessage -UserId \"sfoley@buxtonco.com\" -Filter \"conversationId eq '\''$CONV_ID'\''\" -OrderBy \"receivedDateTime\" -Top 5 -Select \"subject,from,receivedDateTime,bodyPreview\" | ConvertTo-Json
"'
```

### Slack Thread Context

```sql
SELECT ts, user, text
FROM MESSAGE
WHERE thread_ts = '$PARENT_TS' OR ts = '$PARENT_TS'
ORDER BY ts
LIMIT 10;
```

## Step 4: Define Categories

Use categories appropriate to the source and context. Default categories:

### Email Categories

| Category | Description |
|----------|-------------|
| `Action-Required` | Needs response or action from user |
| `FYI-Internal` | Internal notifications, no action needed |
| `SaaS-Notifications` | Automated alerts from SaaS tools |
| `AWS-Cloud` | Cloud infrastructure alerts |
| `Vendor-Sales` | Sales/marketing from vendors |
| `Support-Request` | Customer/user support requests |
| `Colleagues` | Direct messages from known colleagues |

### Slack Categories

| Category | Description |
|----------|-------------|
| `Urgent` | Requires immediate attention |
| `Action-Needed` | Needs response but not urgent |
| `Discussion` | FYI, ongoing discussion |
| `Resolved` | Issue already resolved |
| `Noise` | Low-value, can be ignored |

## Step 5: AI Categorization

For each message with thread context, use PAI Inference:

```bash
cat << 'EOF' | bun ~/.claude/tools/Inference.ts standard
# Message Categorization

## Categories
- Action-Required: Needs response or action
- FYI-Internal: Internal notification, no action
- SaaS-Notifications: Automated SaaS alerts
- AWS-Cloud: Cloud infrastructure
- Vendor-Sales: Sales/marketing
- Support-Request: Customer support
- Colleagues: Direct colleague messages

## Message to Categorize

**From:** ${FROM}
**Subject:** ${SUBJECT}
**Preview:** ${BODY_PREVIEW}

## Thread Context (oldest first)
${THREAD_CONTEXT}

## Task

Categorize this message. Output JSON only:

```json
{
  "category": "Category-Name",
  "confidence": 8,
  "reasoning": "Brief explanation"
}
```
EOF
```

### Batch Processing

For efficiency, batch 10-20 messages per inference call:

```bash
cat << 'EOF' | bun ~/.claude/tools/Inference.ts standard
# Batch Message Categorization

## Categories
[same as above]

## Messages to Categorize

### Message 1
**ID:** ${ID_1}
**From:** ${FROM_1}
**Subject:** ${SUBJECT_1}
**Thread Context:** ${CONTEXT_1}

### Message 2
[...]

## Task

Categorize each message. Output JSON array:

```json
[
  {"id": "msg-1", "category": "Action-Required", "confidence": 9, "reasoning": "..."},
  {"id": "msg-2", "category": "SaaS-Notifications", "confidence": 8, "reasoning": "..."}
]
```
EOF
```

## Step 6: Generate Report

Present categorization summary to user:

```markdown
## Triage Summary

**Source:** Email (MS365 Inbox)
**Messages Processed:** 127
**Processing Time:** 4m 23s

### By Category

| Category | Count | High Confidence | Examples |
|----------|-------|-----------------|----------|
| Action-Required | 12 | 10 | "Budget approval needed", "Please review PR" |
| SaaS-Notifications | 45 | 43 | Site24x7, Datadog, PagerDuty |
| Colleagues | 23 | 20 | Direct messages from team |
| FYI-Internal | 31 | 28 | Newsletter, announcements |
| Vendor-Sales | 16 | 14 | Marketing emails |

### Low Confidence Items (Review Needed)

| From | Subject | Suggested | Confidence |
|------|---------|-----------|------------|
| alice@ex.com | Re: Project | Action-Required | 5 |
| vendor@ex.com | Important Update | Vendor-Sales | 4 |
```

## Step 7: Apply Actions (With Approval)

After user reviews and approves:

### Email: Apply Categories

```bash
# Tag with Outlook categories
zsh -ic 'auth-keeper ms365 "
  Update-MgUserMessage -UserId \"sfoley@buxtonco.com\" -MessageId \"$MSG_ID\" -Categories @(\"Triage\", \"$CATEGORY\")
"'
```

### Email: Archive Low-Value

```bash
# Move to archive
ARCHIVE_ID="AAMkADI3MmY0MzEyLTdmZjUtNDlmYy1hY2M0LWM0OWI5MTk4OTJmZAAuAAAAAADgR5-ehmMHQ56-S2XLLTuRAQB0VhUO-AdETYjxkGzxsZAvAAEi3SN1AAA="

zsh -ic 'auth-keeper ms365 "
  Move-MgUserMessage -UserId \"sfoley@buxtonco.com\" -MessageId \"$MSG_ID\" -DestinationId \"$ARCHIVE_ID\"
"'
```

### Slack: React or Move

Slack doesn't support categories, so options are:
- Add emoji reactions as pseudo-categories
- Generate action list for manual processing
- Export to task management system

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `auth-keeper not found` | Not in interactive shell | Use `zsh -ic` wrapper |
| `Token expired` | MS365 token stale | Re-auth: `auth-keeper ms365 --auth` |
| `No messages found` | Empty result | Report "No unread messages" |
| `Inference failed` | API issue | Retry with smaller batch |

## Output

On completion, provide:
1. Category summary table
2. List of low-confidence items for review
3. Recommended bulk actions
4. Confirmation prompt before applying changes
