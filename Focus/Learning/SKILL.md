---
name: Learning
description: Open new Claude session in learning workspace. USE WHEN /learning.
---

# Learning

Opens a new Claude Code session in a fresh tmux window for study, courses, and reading.

## Execution

```bash
tmux new-window -n "learning" "cd ~/work/learning && claude"
```

**Behavior:**
- Creates new tmux window named "learning"
- Changes to `~/work/learning` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in learning workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
