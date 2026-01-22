---
name: WhereWasI
description: Session resume and continuity system. USE WHEN where was I, resume, continue, pick up where left off, what was I working on, recent sessions, get back to, return to previous work OR /wherewasi command.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/WhereWasI/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# WhereWasI

Zone-aware session continuity system. Shows recent work sessions filtered by time and context.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WhereWasI workflow"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **Recall** workflow from the **WhereWasI** skill...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Recall** | "where was I", "what was I working on", "continue" | `Workflows/Recall.md` |

## Zone Detection

Zones are inferred from the current working directory:

| Path Pattern | Zone | Description |
|--------------|------|-------------|
| `/data/work/*` | WORK | Professional/work context |
| `/data/home/*` | HOME | Personal/home context |
| Other | ALL | Shows all zones |

## Examples

**Example 1: Recall from current zone**
```
User: "where was I?" (from /data/work/project)
→ Shows recent WORK zone sessions
→ User picks from time-filtered list
→ Gets context about what was in progress
```

**Example 2: Recall with time filter**
```
User: "what was I working on yesterday?"
→ Filters to yesterday's sessions
→ Shows titles and timestamps
→ User selects to get full context
```

**Example 3: Cross-zone recall**
```
User: "/wherewasi --all"
→ Shows sessions from all zones
→ Includes zone label in output
```

## Quick Reference

- **Data source:** `~/.claude/projects/` JSONL transcripts (full conversation history)
- **Time filters:** today (1d), yesterday (2d), 3d, 7d, 30d
- **Zone detection:** Automatic from cwd or explicit with --zone flag
- **Output:** JSON (default) or table format via --format flag
- **Detail view:** Use --detail <session_id> for full context

## Tool

```bash
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts [options]

Options:
  --zone <work|home|all>    Filter by zone (default: auto-detect)
  --days <n>                Show sessions from last n days (default: 7)
  --format <json|table>     Output format (default: json)
  --verbose, -v             Include full user intent
  --detail <session_id>     Show full details for a session
```
