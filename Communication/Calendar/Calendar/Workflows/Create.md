# Create Event Workflow

Create a new calendar event with optional attendees and online meeting.

## Prerequisites

- User provides: subject, date/time, duration
- Optional: location, attendees, body/description, online meeting

## Steps

1. **Gather Event Details**

   Required:
   - Subject/title
   - Start date and time
   - Duration (or end time)

   Optional:
   - Location (room name or address)
   - Attendees (email addresses)
   - Description/body
   - Online meeting (Teams link)

2. **Validate Input**

   - Ensure start time is in the future
   - Check for conflicts with existing events
   - Validate attendee email formats

3. **Check for Conflicts**

   ```bash
   # Check if time slot is free
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts json schedule
   ```

4. **Route to Backend**

   ### If ZONE=work (MS365)

   **Option A: Use calendar.ts createEvent function (Recommended)**

   ```typescript
   import { createEvent } from './_shared/api/calendar';

   const event = await createEvent({
     subject: "Meeting Title",
     start: new Date("2024-01-20T14:00:00"),
     end: new Date("2024-01-20T15:00:00"),
     location: "Conference Room A",
     attendees: ["person@example.com"],
     isOnlineMeeting: true,
   });
   ```

   **Option B: Direct PowerShell**
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   auth-keeper ms365 "
   \$user = 'sfoley@buxtonco.com'

   \$params = @{
     Subject = 'Meeting Title'
     Start = @{
       DateTime = '2024-01-20T14:00:00'
       TimeZone = 'America/Denver'
     }
     End = @{
       DateTime = '2024-01-20T15:00:00'
       TimeZone = 'America/Denver'
     }
     Location = @{
       DisplayName = 'Conference Room A'
     }
     Attendees = @(
       @{
         EmailAddress = @{ Address = 'person@example.com' }
         Type = 'required'
       }
     )
     IsOnlineMeeting = \$true
   }

   New-MgUserEvent -UserId \$user -BodyParameter \$params | Select-Object Id, Subject, WebLink
   "
   ```

   ### If ZONE=home (Google Calendar)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   TOKEN=$(auth-keeper google --token)

   # Create event payload
   EVENT_JSON=$(cat <<EOF
   {
     "summary": "Meeting Title",
     "start": {
       "dateTime": "2024-01-20T14:00:00",
       "timeZone": "America/Denver"
     },
     "end": {
       "dateTime": "2024-01-20T15:00:00",
       "timeZone": "America/Denver"
     },
     "location": "Conference Room A",
     "attendees": [
       {"email": "person@example.com"}
     ]
   }
   EOF
   )

   curl -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d "$EVENT_JSON"
   ```

5. **Confirm Creation**

   - Display created event details
   - Show calendar link/URL
   - Note if invites were sent to attendees

## Common Event Types

### Quick 30-min Meeting
```
Subject: Quick Sync
Duration: 30 minutes
Online: Yes (Teams)
```

### 1:1 Meeting
```
Subject: 1:1 with [Name]
Duration: 30-60 minutes
Location: [Office/Teams]
Attendees: [email]
```

### Team Meeting
```
Subject: [Team] Meeting
Duration: 60 minutes
Location: Conference Room / Teams
Attendees: [team distribution list or individuals]
Recurring: Weekly
```

### Focus Time Block
```
Subject: Focus Time - Do Not Book
Duration: 2-4 hours
Show As: Busy
No attendees
```

## Tips

- Always confirm the timezone matches user expectations
- For recurring events, specify pattern clearly (weekly, biweekly, monthly)
- Include Teams/online meeting for remote attendees
- Check attendee availability if creating meetings with others
