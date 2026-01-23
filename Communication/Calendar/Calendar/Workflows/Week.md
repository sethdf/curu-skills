# Week Workflow

Show this week's calendar events with daily breakdown.

## Steps

1. **Detect context**
   ```bash
   echo "Context: ${ZONE:-not set}"
   ```

2. **Route to backend**

   ### If ZONE=work (MS365)

   **Option A: Use calendar.ts CLI (Recommended)**
   ```bash
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts week
   ```

   **Option B: Direct PowerShell**
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   auth-keeper ms365 "
   \$user = 'sfoley@buxtonco.com'
   \$today = (Get-Date).ToUniversalTime()
   \$dayOfWeek = [int]\$today.DayOfWeek
   \$monday = \$today.AddDays(-(\$dayOfWeek - 1))
   \$sunday = \$monday.AddDays(6)

   \$startDate = \$monday.ToString('yyyy-MM-ddT00:00:00Z')
   \$endDate = \$sunday.ToString('yyyy-MM-ddT23:59:59Z')

   Write-Host 'This Week''s Schedule (Work):'
   Write-Host ''

   Get-MgUserCalendarView -UserId \$user -StartDateTime \$startDate -EndDateTime \$endDate |
     Select-Object @{N='Day';E={\$_.Start.DateTime.Substring(0,10)}},
                   @{N='Time';E={\$_.Start.DateTime.Substring(11,5)}},
                   Subject |
     Sort-Object Day, Time |
     Format-Table -GroupBy Day -AutoSize
   "
   ```

   ### If ZONE=home (Google Calendar)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   TOKEN=$(auth-keeper google --token)

   # Calculate week boundaries
   NOW=$(date -u +%Y-%m-%dT00:00:00Z)
   WEEK_END=$(date -u -d "+7 days" +%Y-%m-%dT23:59:59Z)

   echo "This Week's Schedule (Home):"
   echo ""

   curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=$NOW&timeMax=$WEEK_END&singleEvents=true&orderBy=startTime" \
     -H "Authorization: Bearer $TOKEN" | jq -r '
     .items[] |
     "\(.start.dateTime // .start.date | split("T")[0]) \(.start.dateTime // "All Day" | if contains("T") then split("T")[1][0:5] else . end) - \(.summary)"
   ' | sort
   ```

3. **Summarize**
   - Group events by day
   - Note busy days vs light days
   - Identify potential conflicts or double-bookings
   - Highlight important meetings (VIPs, deadlines)
   - Suggest prep needed for upcoming meetings

## Output Format

```
This Week's Schedule:

Monday, Jan 20:
  9:00 AM - 10:00 AM: Team Standup
  2:00 PM - 3:00 PM: 1:1 with Manager

Tuesday, Jan 21:
  10:00 AM - 11:30 AM: Sprint Planning
  3:00 PM - 4:00 PM: Client Call

Wednesday, Jan 22:
  (No meetings - focus day)

...

Summary:
- 12 meetings this week (8h 30m total)
- Busiest day: Tuesday (3 meetings)
- Focus time available: Wednesday, Friday afternoon
```
