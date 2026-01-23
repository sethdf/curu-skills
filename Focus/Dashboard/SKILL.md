---
name: Dashboard
description: Complete overview of ranked messages and tasks. USE WHEN /dashboard, show dashboard, what should I work on, daily overview.
---

# Dashboard

Provides a complete ranked overview of all messages and tasks across all sources. Helps answer "what should I focus on?"

**This skill stays in the current session - it does NOT spawn a new window.**

## Execution

Run these in sequence to build the dashboard:

### 1. Quick Stats

```bash
echo "=== INBOX STATS ===" && \
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts stats 2>/dev/null || echo "Inbox not available"
```

### 2. P0/P1 Items (Urgent)

```bash
echo "=== URGENT (P0/P1) ===" && \
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts query --json --limit 50 2>/dev/null | \
jq -r '.[] | select(.priority == "P0" or .priority == "P1") | "[\(.priority)] \(.source): \(.subject // .title // "No subject")[0:50]"' || \
echo "No P0/P1 items"
```

### 3. Quick Wins

```bash
echo "=== QUICK WINS ===" && \
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts query --json --limit 50 2>/dev/null | \
jq -r '.[] | select(.quick_win == true) | "[\(.priority)] \(.source): \(.subject // .title // "No subject")[0:50]"' || \
echo "No quick wins identified"
```

### 4. Overdue Tickets

```bash
echo "=== OVERDUE TICKETS ===" && \
auth-keeper sdp overdue 2>/dev/null || echo "SDP not available"
```

### 5. Today's Calendar (if available)

```bash
echo "=== TODAY'S CALENDAR ===" && \
auth-keeper calendar today 2>/dev/null || echo "Calendar not available"
```

## Output Format

Present as a structured dashboard:

```
# Daily Dashboard

## Urgent (P0/P1)
- [P0] slack: Production alert from @ops
- [P1] email: Budget approval needed

## Quick Wins (< 5 min each)
- [P2] email: Yes/no decision on vendor
- [P3] slack: Acknowledge message

## Overdue Tickets
- SDP-1234: Password reset (due yesterday)

## Today's Meetings
- 10:00 AM: Standup
- 2:00 PM: 1:1 with manager

## Recommended Focus
1. Handle P0 production alert first
2. Clear 2 quick wins (10 min total)
3. Work on overdue ticket SDP-1234
```

## After Execution

Provide actionable recommendations:
- Which items to handle first
- Estimated time for quick wins
- Suggest opening appropriate workspace (`/tickets`, `/general`, etc.)
