---
name: Meetings
description: Open new Claude session in meetings workspace. USE WHEN /meetings.
---

# Meetings

Opens a new Claude Code session in a fresh tmux window for meeting prep and notes.

## Execution

```bash
tmux new-window -n "meetings" "cd ~/work/meetings && claude"
```

**Behavior:**
- Creates new tmux window named "meetings"
- Changes to `~/work/meetings` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in meetings workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
