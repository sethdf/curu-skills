# Reply Workflow

Draft and send replies to messages across any platform.

## Steps

1. **Identify the message to reply to:**
   - User specifies message (by ID, sender, or context)
   - Or use most recently viewed message

2. **Load full message context:**
   - Retrieve full thread/conversation if available
   - Note sender, subject, key points

3. **Draft reply:**

   ```
   ## Draft Reply

   **To:** sender@example.com
   **Subject:** Re: Meeting request for Q1 planning
   **Platform:** Outlook

   ---

   Hi [Name],

   [Draft response based on context and user guidance]

   Best,
   Seth
   ---

   **Actions:**
   1. Send as-is
   2. Edit (provide changes)
   3. Regenerate (different tone/approach)
   4. Cancel
   ```

4. **Apply user feedback:**
   - If edit requested, incorporate changes
   - If regenerate, ask for guidance (shorter, more formal, etc.)

5. **Send via platform skill:**
   - Outlook → `/outlook send`
   - Gmail → `/gmail send`
   - Slack → `/slack send`
   - Telegram → `/telegram send`
   - Signal → `signal-interface send`

6. **Confirm:**
   ```
   Reply sent to sender@example.com via Outlook.
   ```

## Tone Adaptation

Adjust tone based on:
- Platform (Slack more casual than email)
- Relationship (check CORE/USER/CONTACTS.md if available)
- Thread history (match formality of conversation)

## Threading

For platforms that support threading:
- Email: Include Re: subject, quote relevant context
- Slack: Reply in thread if message is in thread
- Telegram/Signal: Direct reply
