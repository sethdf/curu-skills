# Next Workflow

Show upcoming events in the next N hours.

## Steps

1. **Use CLI Tool**
   ```bash
   # Default: next 2 hours
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts next

   # Custom duration
   bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts next 4
   ```

2. **Summarize**
   - Show events with times
   - Highlight imminent meetings (next 15 minutes)
   - Note prep time needed
   - Show meeting links for quick join

## Output Format

```
Next 2 hours (2 events):

  10:30 AM - 11:00 AM: Team Standup [Teams]
  11:00 AM - 12:00 PM: Sprint Planning @ Conference Room B

Note: Team Standup starts in 15 minutes
```

## Use Cases

1. **Quick check** - "What's coming up?"
2. **Meeting prep** - "Do I have anything in the next hour?"
3. **Focus window** - "Can I start this task or do I have a meeting soon?"
4. **Startup ritual** - Know immediate obligations before planning
