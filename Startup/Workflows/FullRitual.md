# Full Startup Ritual

The complete morning ritual - run this BEFORE opening Slack or email.

## Prerequisites

- Must be in work zone (`$ZONE=work`) or set it: `export ZONE=work`
- Auth-keeper tokens valid (run `auth-keeper status` to check)

## Steps

### Phase 1: Brain Dump (2 minutes)

**Purpose:** Get overnight thoughts OUT of your head so they don't distract you.

1. **Ask the user:**
   > "Any thoughts, ideas, or tasks swirling in your head? Let's dump them now so you can focus."

2. **Capture responses:**
   - Ideas → Append to `~/.claude/skills/CORE/USER/TELOS/IDEAS.md`
   - Tasks → Add to scratch file `~/work/scratch/$(date +%Y-%m-%d).md`
   - Nothing → Move to next phase

3. **Confirm capture:**
   > "Captured X items. They're parked safely - you can ignore them now."

### Phase 2: Pull Today's View (3 minutes)

**Purpose:** Gather data from all sources without getting sucked in.

Run these in parallel:

```bash
# Calendar - today's events and free slots
bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts schedule

# SDP - assigned tickets (if available)
# Note: Use SDPRequests skill or sdp-api if configured

# UnifiedInbox sync (if configured)
# bun ~/.claude/skills/Inbox/UnifiedInbox/Tools/inbox.ts sync
```

**Do NOT:**
- Read email content
- Respond to anything
- Open Slack

### Phase 3: Review Priorities (5 minutes)

**Display dashboard view:**

```
TODAY'S LANDSCAPE

Calendar:
  [List today's meetings with times]
  Focus windows: [Available time blocks]

High Priority Items:
  [P0 items - critical/overdue]
  [P1 items - important]

Quick Wins (< 15 min):
  [Items that can be knocked out fast]

Overdue:
  [Past due tickets or tasks]
```

**Analyze and present:**
1. Flag any P0/critical items
2. Identify quick wins
3. Note overdue items
4. Show time available for focus work

### Phase 4: Pick ONE Thing (2 minutes)

**Ask the user:**
> "Looking at these priorities, which ONE thing will you focus on until [first meeting / 9 AM / break]?"

**Selection criteria:**
1. P0 items take precedence unless blocked
2. Quick wins can clear mental load first
3. Deep work during longest focus window
4. Overdue items need attention soon

**Confirm selection:**
> "Got it. Your ONE thing is: [selected item]"

### Phase 5: Break Down If Needed (2 minutes)

**If the selected task is ambiguous:**
> "What's the first concrete action to move this forward?"

Help identify:
- A specific file to open
- A specific person to contact
- A specific command to run
- A specific document to read

**The first action should be stupid-obvious.** If it's not, keep breaking down.

**Examples:**
- Ambiguous: "Fix the bug"
- Concrete: "Open CloudWatch logs and find the error timestamp"

- Ambiguous: "Prepare presentation"
- Concrete: "Create new slide deck file and write title slide"

### Phase 6: Commit and Start (1 minute)

**Display focus card:**

```
FOCUS MODE ACTIVE

Your ONE thing: [Selected task]
First action: [Concrete step]
Until: [Time of first meeting or 9 AM]

Slack/Email: Closed until [time]

Starting now. Good luck.
```

**Optional:** Start a timer (pomodoro or until next meeting)

## After the Ritual

- Work on your ONE thing
- New ideas that pop up → Quick dump to scratch file, return to work
- Interruptions → Evaluate: Is this more important than my ONE thing? Usually no.
- At [break time] → Open Slack, process reactive work, then run `/startup quick` for next block

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't decide on ONE thing | Pick the overdue one, or flip a coin - action beats analysis paralysis |
| Everything feels urgent | P0 = actual outage/deadline today. Everything else can wait 1 hour. |
| Calendar is back-to-back | Find the gap, even 30 min. Or: your ONE thing is surviving meetings well. |
| Mind keeps wandering | Write down the distraction, return to work. Repeat. |
