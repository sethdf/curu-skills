# Categorize Workflow

**AI-powered categorization of cached messages using PAI Inference with thread context.**

This workflow operates on the local SQLite cache created by the Export workflow.

## Prerequisites

- Messages exported to `~/.cache/message-triage/messages.sqlite`
- PAI Inference tool: `~/.claude/tools/Inference.ts`
- Thread context populated in cache

## Step 1: Load Uncategorized Messages

```bash
CACHE_DB="${HOME}/.cache/message-triage/messages.sqlite"

# Get messages without categories
sqlite3 -json "$CACHE_DB" << 'SQL'
SELECT
  m.id,
  m.source,
  m.from_name,
  m.from_address,
  m.subject,
  m.body_preview,
  m.thread_id,
  GROUP_CONCAT(
    tc.position || '. ' || tc.from_name || ': ' || tc.body_preview,
    '\n'
  ) as thread_context
FROM messages m
LEFT JOIN thread_context tc ON m.id = tc.message_id
WHERE m.category IS NULL
GROUP BY m.id
ORDER BY m.timestamp DESC
LIMIT 100;
SQL
```

## Step 2: Define Category Schema

### Email Categories

```yaml
categories:
  - name: Action-Required
    description: Needs direct response or action from the user
    examples:
      - Approval requests
      - Direct questions requiring answers
      - Action items assigned to user

  - name: Colleagues
    description: Direct messages from known team members
    examples:
      - 1:1 communications
      - Team discussions requiring awareness

  - name: Support-Request
    description: Customer or internal support requests
    examples:
      - Help desk tickets
      - Customer questions
      - Bug reports

  - name: SaaS-Notifications
    description: Automated alerts from SaaS tools
    examples:
      - Monitoring alerts (Site24x7, Datadog)
      - CI/CD notifications
      - Security tool alerts (Securonix, Sophos)

  - name: AWS-Cloud
    description: Cloud infrastructure notifications
    examples:
      - AWS alerts
      - Azure notifications
      - Cloud billing

  - name: FYI-Internal
    description: Internal notifications, no action needed
    examples:
      - Newsletters
      - Announcements
      - Automated reports

  - name: Vendor-Sales
    description: Sales and marketing from external vendors
    examples:
      - Product pitches
      - Conference invites
      - Vendor newsletters
```

### Slack Categories

```yaml
categories:
  - name: Urgent
    description: Requires immediate attention
    examples:
      - Production incidents
      - Critical bugs
      - Escalations

  - name: Action-Needed
    description: Needs response but not time-critical
    examples:
      - Questions directed at user
      - Review requests
      - Approvals

  - name: Discussion
    description: FYI, ongoing conversation
    examples:
      - Team discussions
      - Planning threads
      - General chat

  - name: Resolved
    description: Issue already handled
    examples:
      - Closed tickets
      - Completed deployments
      - Answered questions

  - name: Noise
    description: Low-value, safe to ignore
    examples:
      - Bot spam
      - Off-topic chat
      - Duplicate notifications
```

## Step 3: Build Categorization Prompt

For each batch of messages, construct the prompt:

```markdown
# Message Categorization Task

You are an expert at triaging messages. Your goal is to categorize each message accurately based on:
1. The message content
2. The sender
3. The THREAD CONTEXT (most important for short replies)

## Categories

{{CATEGORY_DEFINITIONS}}

## Messages to Categorize

{{#each messages}}
### Message {{@index}}
**ID:** {{id}}
**Source:** {{source}}
**From:** {{from_name}} <{{from_address}}>
**Subject:** {{subject}}
**Preview:** {{body_preview}}

**Thread Context:**
{{thread_context}}

---
{{/each}}

## Instructions

1. Read thread context FIRST - a message saying "Yes" or "Done" only makes sense in context
2. Consider the sender - internal colleagues vs external vendors have different defaults
3. Look for action triggers: questions, requests, deadlines, @mentions
4. When uncertain, choose the more actionable category (safer for triage)

## Output Format

Return a JSON array with one object per message:

```json
[
  {
    "id": "message-id-1",
    "category": "Action-Required",
    "confidence": 9,
    "reasoning": "Direct question from colleague asking for budget approval by Friday"
  },
  {
    "id": "message-id-2",
    "category": "SaaS-Notifications",
    "confidence": 10,
    "reasoning": "Automated Site24x7 monitoring alert, no thread context"
  }
]
```

**Confidence Scale:**
- 10: Absolutely certain (automated alerts, clear patterns)
- 8-9: Very confident (clear context, obvious category)
- 6-7: Confident (some ambiguity but reasonable choice)
- 4-5: Low confidence (needs human review)
- 1-3: Uncertain (multiple valid categories)
```

## Step 4: Execute AI Categorization

```bash
# Build prompt with messages
PROMPT=$(cat << 'EOF'
[Full prompt from Step 3 with actual message data]
EOF
)

# Call PAI Inference (standard = Sonnet)
RESULT=$(echo "$PROMPT" | bun ~/.claude/tools/Inference.ts standard)

# Parse JSON result
echo "$RESULT" | jq -c '.[]' | while read -r cat; do
  ID=$(echo "$cat" | jq -r '.id')
  CATEGORY=$(echo "$cat" | jq -r '.category')
  CONFIDENCE=$(echo "$cat" | jq -r '.confidence')
  REASONING=$(echo "$cat" | jq -r '.reasoning' | sed "s/'/''/g")

  # Update cache
  sqlite3 "$CACHE_DB" "
    UPDATE messages
    SET category = '$CATEGORY',
        confidence = $CONFIDENCE,
        reasoning = '$REASONING'
    WHERE id = '$ID';
  "
done
```

## Step 5: Batch Processing

For large message sets, process in batches:

```bash
BATCH_SIZE=15
OFFSET=0

while true; do
  # Get next batch
  BATCH=$(sqlite3 -json "$CACHE_DB" "
    SELECT id, source, from_name, from_address, subject, body_preview, thread_id
    FROM messages
    WHERE category IS NULL
    ORDER BY timestamp DESC
    LIMIT $BATCH_SIZE OFFSET $OFFSET;
  ")

  # Check if batch is empty
  if [ "$(echo "$BATCH" | jq 'length')" -eq 0 ]; then
    break
  fi

  # Process batch
  # [Build prompt and call inference]

  OFFSET=$((OFFSET + BATCH_SIZE))

  # Rate limiting
  sleep 1
done
```

## Step 6: Generate Categorization Report

```bash
sqlite3 "$CACHE_DB" << 'SQL'
.mode column
.headers on

SELECT '=== Categorization Summary ===' as '';

SELECT
  category,
  COUNT(*) as count,
  ROUND(AVG(confidence), 1) as avg_confidence,
  SUM(CASE WHEN confidence >= 8 THEN 1 ELSE 0 END) as high_conf,
  SUM(CASE WHEN confidence < 6 THEN 1 ELSE 0 END) as low_conf
FROM messages
WHERE category IS NOT NULL
GROUP BY category
ORDER BY count DESC;

SELECT '=== Low Confidence Items (Review Needed) ===' as '';

SELECT
  id,
  from_address,
  subject,
  category,
  confidence,
  reasoning
FROM messages
WHERE confidence < 6
ORDER BY confidence ASC
LIMIT 20;

SELECT '=== Sample Categorizations ===' as '';

SELECT
  substr(from_address, 1, 25) as "from",
  substr(subject, 1, 40) as subject,
  category,
  confidence
FROM messages
WHERE category IS NOT NULL
ORDER BY RANDOM()
LIMIT 10;
SQL
```

## Output

Present to user:

```markdown
## Categorization Complete

**Messages Processed:** 127
**Processing Time:** 2m 45s
**Average Confidence:** 8.2/10

### Category Distribution

| Category | Count | Avg Confidence | High Conf | Low Conf |
|----------|-------|----------------|-----------|----------|
| SaaS-Notifications | 45 | 9.5 | 44 | 0 |
| FYI-Internal | 31 | 8.1 | 28 | 2 |
| Colleagues | 23 | 8.4 | 20 | 1 |
| Vendor-Sales | 16 | 7.8 | 12 | 3 |
| Action-Required | 12 | 7.2 | 8 | 3 |

### Items Needing Review (Confidence < 6)

| From | Subject | Suggested | Confidence | Reasoning |
|------|---------|-----------|------------|-----------|
| alice@ex.com | Re: Project | Action-Required | 5 | Short reply, context unclear |
| vendor@ex.com | Update | Vendor-Sales | 4 | Could be support or sales |

### Next Steps

1. Review low-confidence items above
2. Run Triage workflow to apply categories
3. Set up recurring categorization schedule
```

## Recategorization

To re-run categorization (e.g., after category changes):

```bash
# Clear existing categories
sqlite3 "$CACHE_DB" "UPDATE messages SET category = NULL, confidence = NULL, reasoning = NULL;"

# Re-run categorization
# [Execute this workflow again]
```

## Custom Categories

To use custom categories, create a PREFERENCES.md in:
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/MessageTriage/`

```yaml
# PREFERENCES.md
email_categories:
  - name: Custom-Category
    description: My custom category
    examples:
      - Example 1
      - Example 2
```
