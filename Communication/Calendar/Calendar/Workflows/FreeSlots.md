# Free Slots Workflow

Find available time slots in the calendar for focus work or scheduling.

## Steps

1. **Use CLI Tool (Recommended)**
   ```bash
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts free
   ```

   Output shows free slots during workday (8 AM - 5 PM) with minimum 30-minute duration.

2. **For JSON Output**
   ```bash
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts json schedule
   ```

   Returns:
   ```json
   {
     "date": "2024-01-20",
     "events": [...],
     "freeSlots": [
       {
         "start": "2024-01-20T08:00:00",
         "end": "2024-01-20T09:00:00",
         "durationMinutes": 60
       }
     ],
     "busyMinutes": 240,
     "freeMinutes": 300
   }
   ```

3. **Summarize**
   - List available time blocks
   - Highlight longest continuous free period
   - Suggest best time for deep work
   - Note if day is heavily booked

## Output Format

```
Free slots today (workday 8:00 AM - 5:00 PM):

  8:00 AM - 9:00 AM (1h free)
  11:30 AM - 1:00 PM (1h 30m free)
  3:00 PM - 5:00 PM (2h free)

Summary: 4h 30m in meetings, 4h 30m free

Recommendation: Best focus window is 3:00 PM - 5:00 PM (2 hours uninterrupted)
```

## Use Cases

1. **Finding focus time** - "When can I do deep work today?"
2. **Scheduling flexibility** - "When am I free for a 1-hour meeting?"
3. **Daily planning** - "What's my availability look like?"
4. **Startup ritual** - Quick view of day structure for planning
