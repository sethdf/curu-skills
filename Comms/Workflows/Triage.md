# Triage Workflow

Process messages toward inbox zero using the 4 D's: Delete, Do, Delegate, Defer.

## Steps

1. **Get unread messages from all platforms** (via Check workflow)

2. **Sort by priority:**
   - Urgent/flagged first
   - Then by age (oldest first)
   - Group by sender if multiple from same person

3. **Present each message for decision:**

   ```
   ## Message 1 of X

   **Platform:** Outlook
   **From:** sender@example.com
   **Subject:** Meeting request for Q1 planning
   **Preview:** Hi Seth, I'd like to schedule a meeting to discuss...
   **Age:** 2 hours

   ### Suggested Action: Calendar
   This appears to be a meeting request.

   **Options:**
   1. Archive (already handled / not needed)
   2. Reply (draft a response)
   3. Calendar (add event and reply)
   4. Defer (snooze for later)
   5. Skip (move to next)
   ```

4. **Execute chosen action:**

   | Action | What happens |
   |--------|--------------|
   | Archive | Move to archive, mark read |
   | Reply | Draft response, send when approved |
   | Calendar | Extract details, create event, draft confirmation reply |
   | Defer | Mark for follow-up, set reminder |
   | Skip | Move to next message |

5. **Track progress:**

   ```
   Progress: 5/12 processed
   - Archived: 2
   - Replied: 2
   - Calendar: 1
   - Remaining: 7
   ```

## Decision Heuristics

Suggest actions based on content:
- Meeting/schedule mentions → Calendar
- Question requiring response → Reply
- Newsletter/notification → Archive
- Action item for someone else → Delegate (if supported)
- Complex item needing thought → Defer

## Completion

When all messages processed:
```
## Inbox Zero Achieved!

Session summary:
- Processed: 12 messages
- Archived: 5
- Replied: 4
- Calendar events: 2
- Deferred: 1

Time spent: ~15 minutes
```
