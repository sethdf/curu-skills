# InboxRank Scoring Criteria

Detailed documentation of the priority scoring model.

## Overview

InboxRank uses a deterministic scoring model to calculate priority. The AI determines the category, then the scoring model calculates priority based on category and contextual modifiers.

## Base Scores

| Category | Base Score | Rationale |
|----------|------------|-----------|
| Action-Required | 60 | Needs direct action, starts high |
| Delegatable | 40 | Important but can be handed off |
| FYI | 20 | Informational, low urgency |
| Spam | 0 | Unwanted, lowest priority |
| Archive | 0 | No longer relevant |

## Modifiers

### VIP Sender (+30)

Applied when the sender is in the VIP contacts list. This ensures messages from important people are surfaced quickly.

**Criteria:** `contacts.is_vip = true` for matching email/slack_user_id

### Overdue (+25)

Applied when a ticket or task is past its due date.

**Criteria:** `metadata.dueDate < today`

### Due Today (+15)

Applied when something is due today but not yet overdue.

**Criteria:** `metadata.dueDate` is today AND not overdue

### High Priority Source (+20)

Applied when the source system marks the item as high priority.

**Criteria:**
- `metadata.priority = "high"` OR
- `metadata.priority = "urgent"` OR
- `metadata.importance = "high"` OR
- `metadata.urgency = "high"`

### Has Attachment (+5)

Applied when the item has attachments, indicating potential action needed.

**Criteria:**
- `metadata.hasAttachments = true` OR
- `metadata.attachments.length > 0`

### Thread Reply (+10)

Applied when the item is part of an ongoing conversation, indicating context exists.

**Criteria:**
- `item.threadId` exists OR
- `item.threadContext.length > 0`

### Slack DM (+10)

Applied when the item is a direct message on Slack, indicating personal attention expected.

**Criteria:**
- `item.source = "slack"` AND
- (`metadata.channelType = "im"` OR `metadata.isDm = true`)

### Old Item (+5)

Applied when an unread item has been sitting for more than 48 hours, indicating it might be forgotten.

**Criteria:** `(now - item.timestamp) > 48 hours`

## Score to Priority Mapping

| Score Range | Priority | Response Time |
|-------------|----------|---------------|
| 80+ | P0 (Critical) | Immediate (< 1 hour) |
| 60-79 | P1 (High) | Today |
| 40-59 | P2 (Normal) | This week |
| 0-39 | P3 (Low) | When convenient |

## Example Calculations

### Example 1: VIP Slack DM

- Category: Action-Required (base: 60)
- VIP sender: +30
- Slack DM: +10
- **Total: 100 → P0**

### Example 2: Regular Email FYI

- Category: FYI (base: 20)
- No modifiers
- **Total: 20 → P3**

### Example 3: Overdue SDP Ticket

- Category: Action-Required (base: 60)
- Overdue: +25
- High priority (source): +20
- **Total: 105 → P0**

### Example 4: Thread Reply with Attachment

- Category: Delegatable (base: 40)
- Thread reply: +10
- Has attachment: +5
- **Total: 55 → P2**

## Customization

To customize scoring weights, modify `Tools/scoring.ts`:

```typescript
// Adjust base scores
const BASE_SCORES = {
  "Action-Required": 60,  // Change this value
  ...
};

// Adjust modifiers in calculateScore()
if (context.isVip) {
  modifiers.push({ name: "VIP sender", value: 30 });  // Change this value
}
```

## Design Rationale

1. **Category First**: AI determines semantic meaning (what type of item)
2. **Deterministic Scoring**: Consistent, predictable priority calculation
3. **Additive Modifiers**: Easy to understand and debug
4. **Clear Thresholds**: Distinct priority levels with action implications

## Validation

To validate scoring for a batch of items:

```bash
inboxrank --dry-run --verbose --limit 20
```

This shows the full scoring breakdown for each item without saving results.
