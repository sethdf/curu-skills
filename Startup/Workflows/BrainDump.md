# Brain Dump Workflow

Quickly capture thoughts, ideas, and tasks without losing focus.

## Purpose

When random thoughts intrude during focus time:
1. Capture them immediately
2. Get them out of your head
3. Return to work without context switching

## Invocation

- "brain dump [your thought]"
- "dump: [idea]"
- "park this: [thought]"

## Steps

### 1. Classify the Input

| Type | Destination |
|------|-------------|
| Idea (new project, feature, someday) | `TELOS/IDEAS.md` |
| Task (needs doing) | Today's scratch file |
| Note (just capture) | Today's scratch file |
| Urgent (needs immediate attention) | Flag and ask user |

### 2. Capture

**For Ideas:**
```bash
# Append to IDEAS.md
IDEA_FILE=~/.claude/skills/CORE/USER/TELOS/IDEAS.md
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
echo -e "\n## $TIMESTAMP\n$IDEA_TEXT" >> "$IDEA_FILE"
```

**For Tasks/Notes:**
```bash
# Append to today's scratch
SCRATCH_DIR=~/work/scratch
SCRATCH_FILE="$SCRATCH_DIR/$(date +%Y-%m-%d).md"
mkdir -p "$SCRATCH_DIR"
TIMESTAMP=$(date '+%H:%M')
echo "- [$TIMESTAMP] $TASK_TEXT" >> "$SCRATCH_FILE"
```

### 3. Confirm and Return

> "Parked: [summary]. Back to [current focus]."

## Quick Capture Format

When user says something like:
> "dump: remember to check on the CI pipeline"

Response:
> "Captured to scratch. Back to SDP-4521."

No elaboration needed. Speed matters.

## Batch Dump

For multiple items at once:

```
User: brain dump
- CI pipeline thing
- idea for automating reports
- ask Bob about the API change
- book dentist appointment

Response:
Captured 4 items:
- 2 tasks → scratch file
- 1 idea → IDEAS.md
- 1 personal → scratch file

Back to work.
```

## File Locations

| Type | Location |
|------|----------|
| Ideas | `~/.claude/skills/CORE/USER/TELOS/IDEAS.md` |
| Work tasks | `~/work/scratch/YYYY-MM-DD.md` |
| Home tasks | `~/home/scratch/YYYY-MM-DD.md` (if ZONE=home) |

## The Point

The goal is SPEED. Get the thought out of your head in < 30 seconds so you can return to focused work. Don't analyze, categorize extensively, or research - just capture and continue.
