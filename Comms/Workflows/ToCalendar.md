# ToCalendar Workflow

Extract event details from a message and create a calendar entry.

## Steps

1. **Identify the source message:**
   - User specifies message or uses context
   - Load full message content

2. **Extract event details:**

   Parse message for:
   - **Title:** Meeting subject or event name
   - **Date/Time:** When (handle timezone)
   - **Duration:** How long (default 1 hour if not specified)
   - **Location:** Physical address, room, or video link
   - **Attendees:** Who should be invited
   - **Description:** Relevant context from message

3. **Present extracted details:**

   ```
   ## Calendar Event from Message

   **Source:** Outlook message from alice@example.com

   ### Extracted Details:
   - **Title:** Q1 Planning Meeting
   - **Date:** 2026-01-20
   - **Time:** 2:00 PM - 3:00 PM MST
   - **Location:** Zoom (link in message)
   - **Attendees:** alice@example.com, bob@example.com

   ### Which calendar?
   1. Outlook Calendar (work)
   2. Google Calendar (personal)
   ```

4. **Create event via calendar skill:**

   - OutlookCalendar → `/ocal create`
   - GoogleCalendar → `/gcal create`

5. **Optionally send confirmation reply:**

   ```
   Event created. Send confirmation to sender?
   1. Yes - "Thanks, I've added this to my calendar"
   2. Yes - Custom message
   3. No
   ```

6. **Confirm completion:**

   ```
   Created: "Q1 Planning Meeting"
   Calendar: Outlook
   When: Jan 20, 2026 2:00 PM MST
   Confirmation sent to alice@example.com
   ```

## Smart Extraction

Handle various formats:
- "Let's meet Tuesday at 2pm" → Parse relative date
- "30 minute call" → Set duration
- "Zoom link: https://..." → Extract as location
- "with the team" → Check CONTACTS.md for team members

## Conflict Detection

Before creating:
- Check for conflicts on that date/time
- Warn user if overlap detected
- Offer to find alternative times
