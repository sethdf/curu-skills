---
name: Inbox
description: Display ranked messages from all sources. USE WHEN /inbox, show inbox, check messages, what's in my inbox.
---

# Inbox

Displays a ranked summary of messages from all sources (email, Slack, Telegram, SDP tickets/tasks).

**This skill stays in the current session - it does NOT spawn a new window.**

## Execution

1. **Sync inbox** (get latest messages):
```bash
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts sync --quiet
```

2. **Query ranked items**:
```bash
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts query --json --limit 25 | jq -r '
  .[] |
  "\(.priority // "?") | \(.source) | \(.subject // .title // "No subject")[0:60] | \(.sender_name // .sender // "Unknown")"
' 2>/dev/null || echo "Inbox not synced or empty"
```

3. **Get quick stats**:
```bash
bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts stats
```

## Output Format

Display results as a ranked table:

```
## Inbox Overview

| Pri | Source | Subject | From |
|-----|--------|---------|------|
| P0  | slack  | Urgent: Production down | @ops |
| P1  | email  | Q4 Budget Review | finance@... |
| P2  | sdp-ticket | Password reset request | helpdesk |
...

**Stats:** 12 unread, 3 P0/P1, 2 quick wins
```

## After Execution

Show the ranked message table and stats. Offer:
- "Want me to show details on any item?"
- "Should I process quick wins first?"
- "Open `/tickets` or `/general` to work on these?"
