# Pick Focus Workflow

Help choose the ONE thing to work on when feeling scattered.

## When to Use

- "What should I work on?"
- "I don't know where to start"
- "Everything feels important"
- "Help me pick one thing"

## Steps

### 1. Gather Context

Quick assessment of current state:

```bash
# Calendar - what's the focus window?
bun ~/repos/github.com/sethdf/curu-skills/_shared/api/calendar.ts next 4

# Note any time constraints
```

### 2. Present Options

Show the user their top candidates:

```
DECISION TIME

Available focus time: [X hours/minutes] until [meeting/end of day]

Your candidates:

1. [P0] Critical/Overdue item
   Why: Overdue or blocking others

2. [P1] Important deep work
   Why: Moves a key project forward

3. [Quick Win] Small task
   Why: 15 min, clears mental load

4. [Resistance Item] Thing you've been avoiding
   Why: Might be the most important
```

### 3. Apply Decision Framework

Ask these questions in order:

**Q1: Is anything on fire?**
- Production down? Customer waiting? Hard deadline today?
- If yes → that's your ONE thing

**Q2: What's overdue?**
- Past-due tickets, missed deadlines
- If something is overdue → strong candidate

**Q3: What would feel best to finish?**
- Often the thing you're avoiding
- Completing it removes mental weight

**Q4: What fits the time window?**
- 30 min available? → Quick win
- 2 hours available? → Deep work
- Match task size to window

### 4. Make the Call

> "Based on [reasoning], I recommend: [TASK]"
>
> "Or if you'd prefer, [alternative] is also valid."
>
> "What's your call?"

### 5. Confirm and Define First Action

Once chosen:
> "Your ONE thing: [TASK]"
> "First concrete action: ?"

Help make the first step stupidly obvious.

## Decision Shortcuts

When paralyzed, use these tiebreakers:

| Situation | Rule |
|-----------|------|
| Two equal priorities | Pick the one you've been avoiding |
| Everything urgent | Pick the one with external deadline |
| Nothing urgent | Pick what grows your skills/career |
| Can't decide at all | Flip a coin - action beats paralysis |

## Anti-Patterns

| Wrong | Right |
|-------|-------|
| "I'll do a bit of everything" | Pick ONE thing |
| "Let me check Slack first" | Slack can wait 1 hour |
| "I need more information" | Start with what you know |
| "This is too hard" | Break it down until first step is easy |

## Output

```
FOCUS LOCKED

Your ONE thing: [Task]
Why: [Brief reason]
First action: [Concrete step]
Time box: [Duration] until [end time]

Slack/email closed.
Starting now.
```
