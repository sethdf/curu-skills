# Daily Brief Workflow

Invoked by `/gcal` or "what's on my calendar".

## Workflow Steps

### 1. Fetch Today's Events

```bash
bun run ~/.claude/skills/GoogleCalendar/Tools/GCalClient.ts today
```

### 2. Analyze Schedule

- Calculate total meeting time
- Identify back-to-back meetings
- Find focus time blocks
- Flag conflicts

### 3. Present Brief

Format output as:

```
DAILY BRIEF - [date]

SCHEDULE OVERVIEW
  Meetings: 5 (3.5 hours)
  Focus time: 2.5 hours
  Conflicts: None

TODAY'S EVENTS

  9:00 AM - 9:30 AM
    Team Standup
    @ Conference Room A

  10:00 AM - 11:00 AM
    Project Review
    Attendees: Alice, Bob, Carol
    [Google Meet link]

  ...

FREE SLOTS
  8:00 AM - 9:00 AM (1h)
  11:00 AM - 12:00 PM (1h)
  2:30 PM - 5:00 PM (2.5h)

PREP NOTES
  - Project Review: Review PR #123 beforehand
  - 1:1 with Manager: Prepare status update
```

### 4. Integration with Email

Cross-reference with Gmail:
- Surface emails from meeting attendees
- Highlight emails about meeting topics

## Example Interaction

```
User: /gcal
-> Shows today's schedule
-> Highlights prep needed
-> Shows free time
```
