---
name: Startup
description: Morning startup ritual to beat distraction and focus on what matters. USE WHEN starting work day, /startup, /morning, "what should I work on", daily planning. Runs BEFORE opening Slack/email.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Startup/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Startup - Morning Ritual Skill

**Purpose:** Combat the scatter-brain cycle of overwhelm → resistance → distraction by creating a calm, focused start to the workday.

**Invocation:** `/startup` or `/morning`

**Critical Rule:** This ritual runs BEFORE opening Slack, email, or any reactive channel.

## The Problem This Solves

```
Without ritual:
8:00 AM → Open Slack "just to check"
8:01 AM → See message that seems urgent
8:02 AM → Start responding
8:45 AM → Still in reactive mode, your priorities forgotten
9:30 AM → Finally try to focus, but energy spent
```

```
With /startup:
7:55 AM → Run /startup
8:00 AM → Brain dumped, priorities clear, ONE thing chosen
8:00-9:00 AM → Protected focus time on #1 priority
9:00 AM+ → Open Slack from position of strength
```

## The Ritual (15 minutes max)

| Phase | Time | Purpose |
|-------|------|---------|
| 1. Brain Dump | 2 min | Get overnight ideas OUT of head |
| 2. Pull Today | 3 min | Sync SDP, email, calendar |
| 3. Review Priorities | 5 min | See top items, overdue, quick wins |
| 4. Pick ONE | 2 min | Choose primary focus until first break |
| 5. Break Down | 2 min | Define first concrete action if ambiguous |
| 6. Commit | 1 min | Lock in, start timer |

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Full** | `/startup`, `/morning`, "start my day" | `Workflows/FullRitual.md` |
| **Quick** | `/startup quick`, "quick startup" | `Workflows/QuickRitual.md` |
| **Dump** | "brain dump", "dump ideas" | `Workflows/BrainDump.md` |
| **Focus** | "what should I focus on", "pick one thing" | `Workflows/PickFocus.md` |

## Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `startup.ts` | Orchestrate the full ritual | `bun startup.ts` |
| `brain-dump.ts` | Capture ideas to parking lot | `bun brain-dump.ts "idea..."` |

## Integration with Existing Skills

This skill orchestrates:
- **UnifiedInbox** - Sync messages from all sources
- **InboxRank** - AI prioritization of inbox items
- **Calendar** - Today's schedule and free slots
- **SDPRequests** - Work tickets assigned to you
- **Dashboard** - Display ranked priorities

## Configuration

Default workday: 8:00 AM - 5:00 PM (configurable in PREFERENCES.md)

```yaml
# ~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Startup/PREFERENCES.md
workday_start: "8:00"
workday_end: "17:00"
focus_block_hours: 1
slack_ok_after: "9:00"
brain_dump_location: "~/work/scratch"
ideas_location: "~/.claude/skills/CORE/USER/TELOS/IDEAS.md"
```

## Output Format

After running `/startup`, you see:

```
STARTUP COMPLETE

Brain Dump: 2 items captured to IDEAS.md

Today's Schedule:
  9:00 AM - Team Standup (30m)
  2:00 PM - Sprint Review (1h)
  Focus available: 8:00-9:00 AM, 10:00 AM-2:00 PM, 3:00 PM-5:00 PM

Top 3 Priorities:
  1. [P0] SDP-4521: Production database issue (overdue)
  2. [P1] Review PR #892 (quick win, 15m)
  3. [P1] Prepare sprint demo slides

YOUR ONE THING until 9:00 AM:
  → SDP-4521: Production database issue

First action: Check CloudWatch logs for error spike timestamp

Slack stays closed until: 9:00 AM
```

## Anti-Patterns (What NOT to Do)

| Wrong | Right |
|-------|-------|
| Check Slack "just for a second" first | Run /startup THEN Slack |
| Pick 5 things to work on | Pick ONE thing |
| Start without knowing calendar | Check calendar for meeting interrupts |
| Keep ideas in head | Dump to parking lot immediately |
| Work on easy stuff because hard stuff is vague | Break down until first action is obvious |

## Tips for Success

1. **Make it automatic** - Alias `claude` to run `/startup` on session start
2. **Protect the block** - Calendar block 8-9 AM as "Focus Time"
3. **Trust the process** - Even if Slack feels urgent, the world won't end in 1 hour
4. **Capture, don't chase** - New ideas go to parking lot, not immediate action
5. **One thing only** - If you finish early, THEN pick the next thing
