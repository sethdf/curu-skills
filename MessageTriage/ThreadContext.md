# Thread Context Handling

**SOP for extracting and using thread/conversation context in message categorization.**

Thread context is CRITICAL for accurate categorization. A message saying "Yes, approved" means nothing without the preceding conversation. This document defines how to gather and use surrounding context.

## Why Thread Context Matters

| Without Context | With Context |
|-----------------|--------------|
| "Yes" → Unknown | "Yes" in reply to "Can you approve the $50k budget?" → Finance/Approval |
| "See attached" → Unknown | "See attached" after discussing quarterly report → Reports/Action-Needed |
| "Thanks!" → Low-value | "Thanks!" closing a support resolution → Support/Resolved |

**Rule:** Never categorize a message in isolation if thread context is available.

## Email Thread Context

### Headers to Extract

```
In-Reply-To: <message-id@example.com>
References: <msg1@ex.com> <msg2@ex.com> <msg3@ex.com>
Thread-Index: [base64 encoded thread identifier]
```

### MS365 Graph API Thread Retrieval

```powershell
# Get conversation thread by ConversationId
$msg = Get-MgUserMessage -UserId 'user@domain.com' -MessageId $targetId
$convId = $msg.ConversationId

# Retrieve all messages in conversation
Get-MgUserMessage -UserId 'user@domain.com' `
  -Filter "conversationId eq '$convId'" `
  -OrderBy "receivedDateTime" `
  -Select "subject,from,receivedDateTime,bodyPreview"
```

### Thread Context Assembly

For each email being categorized, assemble:

```json
{
  "target_message": {
    "id": "msg-id",
    "subject": "Re: Q4 Budget Review",
    "from": "alice@example.com",
    "body_preview": "Yes, approved. Proceed with the purchase."
  },
  "thread_context": [
    {
      "position": 1,
      "from": "bob@example.com",
      "subject": "Q4 Budget Review",
      "body_preview": "Team, please review the attached Q4 budget proposal."
    },
    {
      "position": 2,
      "from": "carol@example.com",
      "subject": "Re: Q4 Budget Review",
      "body_preview": "I have concerns about the marketing spend..."
    },
    {
      "position": 3,
      "from": "bob@example.com",
      "subject": "Re: Q4 Budget Review",
      "body_preview": "Alice, can you approve the revised version?"
    }
  ],
  "thread_length": 4,
  "thread_participants": ["bob@example.com", "carol@example.com", "alice@example.com"]
}
```

## Slack Thread Context

### Thread Structure

Slack threads have:
- **Parent message**: The original message that started the thread
- **Replies**: Messages in the thread (`thread_ts` matches parent `ts`)
- **Channel context**: Recent messages before/after the thread

### Slackdump SQLite Schema

```sql
-- Get thread context
SELECT
  ts,
  user,
  text,
  thread_ts
FROM MESSAGE
WHERE channel_id = 'C123456'
  AND (ts = 'parent_ts' OR thread_ts = 'parent_ts')
ORDER BY ts;

-- Get surrounding channel context (non-threaded)
SELECT ts, user, text
FROM MESSAGE
WHERE channel_id = 'C123456'
  AND thread_ts IS NULL
  AND ts BETWEEN datetime('target_ts', '-1 hour') AND datetime('target_ts', '+1 hour')
ORDER BY ts;
```

### Thread Context Assembly (Slack)

```json
{
  "target_message": {
    "ts": "1704067200.000100",
    "user": "U12345",
    "text": "Done, deployed to production",
    "channel": "#deployments"
  },
  "thread_context": [
    {
      "position": "parent",
      "ts": "1704067000.000001",
      "user": "U67890",
      "text": "Can someone deploy the hotfix for JIRA-1234?"
    },
    {
      "position": 1,
      "ts": "1704067100.000050",
      "user": "U11111",
      "text": "I can take this, running tests now"
    }
  ],
  "channel_context": [
    {
      "ts": "1704066900.000001",
      "user": "U99999",
      "text": "Heads up: there's a critical bug in auth flow"
    }
  ]
}
```

## Context Window Size

### Recommended Limits

| Source | Thread Messages | Surrounding Context |
|--------|-----------------|---------------------|
| Email | Last 5 messages in thread | N/A |
| Slack Thread | All replies (up to 50) | 3 messages before/after |
| Slack Channel | N/A | 5 messages before/after |

### Token Budget

For Sonnet categorization, aim for:
- Target message: ~200 tokens
- Thread context: ~500 tokens max
- Total per message: ~700 tokens
- Batch size: 10-20 messages per API call

## Prompt Template for Context-Aware Categorization

```markdown
# Message Categorization Task

You are categorizing messages for triage. Consider the FULL THREAD CONTEXT when determining category.

## Categories
{{categories}}

## Message to Categorize

**From:** {{from}}
**Subject/Channel:** {{subject_or_channel}}
**Content:** {{body}}

## Thread Context (most recent first)
{{#each thread_context}}
[{{position}}] {{from}}: {{body_preview}}
{{/each}}

## Instructions

1. Read the thread context FIRST to understand the conversation flow
2. Consider who is speaking and their role in the thread
3. Look for action items, decisions, or status changes
4. Categorize based on the OVERALL conversation purpose, not just the target message

## Output Format

```json
{
  "category": "Category Name",
  "confidence": 8,
  "reasoning": "Brief explanation referencing thread context"
}
```
```

## Edge Cases

### No Thread Context Available
- Categorize based on message content alone
- Lower confidence score by 2 points
- Note in reasoning: "No thread context available"

### Very Long Threads (>10 messages)
- Include first message (original context)
- Include last 4 messages (recent context)
- Note in reasoning: "Thread truncated, {N} messages total"

### Cross-Reference Threads
- If message references another thread (forwarded, etc.)
- Attempt to fetch referenced thread
- Include as secondary context if available
