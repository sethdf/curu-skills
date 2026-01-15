# Check Workflow

Aggregate unread/pending messages from all communication platforms.

## Steps

1. **Check platforms in priority order:**

   ```
   For each platform (MS365 -> Gmail -> Slack -> Telegram -> Signal):
     - Invoke the platform skill to get unread count and summaries
     - Capture urgent/high-priority items
     - Note any errors (platform unavailable, auth expired)
   ```

2. **Aggregate results:**

   ```
   Build unified summary:
   - Total unread across all platforms
   - Breakdown by platform
   - Urgent items highlighted
   - Oldest unread age
   ```

3. **Present summary:**

   ```
   ## Communications Summary

   **Outlook:** X unread (Y urgent)
   **Gmail:** X unread
   **Slack:** X mentions in Y channels
   **Telegram:** X messages
   **Signal:** X messages

   ### Urgent Items
   - [Platform] From: sender - Subject/preview

   ### Recommended Actions
   - Start with urgent Outlook items
   - Then process Slack mentions
   ```

## Platform Invocation

Use the Skill tool to invoke each platform:

- `/outlook unread` or Skill(outlook)
- `/gmail unread` or Skill(gmail)
- `/slack unread` or Skill(slack)
- `/telegram unread` or Skill(telegram)
- Signal: `~/bin/signal-interface status`

## Error Handling

If a platform fails:
- Note the error in summary
- Continue with other platforms
- Suggest remediation (re-auth, check config)
