---
name: Tasks
description: Open new Claude session in tasks workspace. USE WHEN /tasks.
---

# Tasks

Opens a new Claude Code session in a fresh tmux window for individual task work.

## Execution

```bash
tmux new-window -n "tasks" "cd ~/work/tasks && claude"
```

**Behavior:**
- Creates new tmux window named "tasks"
- Changes to `~/work/tasks` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in tasks workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
