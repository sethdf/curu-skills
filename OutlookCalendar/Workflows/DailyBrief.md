# Daily Brief Workflow

Invoked by `/ocal` or "outlook schedule".

## Workflow Steps

### 1. Fetch Today's Events

```bash
bun run ~/.claude/skills/OutlookCalendar/Tools/OCalClient.ts today
```

### 2. Analyze Schedule

- Calculate total meeting time
- Identify Teams meetings (with join links)
- Find focus time blocks
- Flag conflicts or double-bookings

### 3. Present Brief

Format output as:

```
OUTLOOK DAILY BRIEF - [date]

SCHEDULE OVERVIEW
  Meetings: 6 (4 hours)
  Teams calls: 3
  Focus time: 2 hours
  Pending responses: 1

TODAY'S EVENTS

  8:30 AM - 9:00 AM [Teams]
    Morning Standup
    Join: https://teams.microsoft.com/...

  10:00 AM - 11:00 AM
    Sprint Planning
    @ Building A, Room 301
    Attendees: 8

  ...

PENDING RESPONSES
  [AAMkAG...] 2:00 PM - Project Kickoff
    /ocal accept AAMkAG...
    /ocal decline AAMkAG...

FREE SLOTS
  9:00 AM - 10:00 AM (1h)
  3:00 PM - 5:00 PM (2h)
```

### 4. Integration with Email

Cross-reference with Outlook:
- Surface emails from meeting organizers
- Highlight meeting-related threads

## Example Interaction

```
User: /ocal
-> Shows today's schedule with Teams links
-> Lists pending meeting responses
-> Shows free time
```
