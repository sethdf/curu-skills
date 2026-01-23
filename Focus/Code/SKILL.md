---
name: Code
description: Open new Claude session in code workspace. USE WHEN /code.
---

# Code

Opens a new Claude Code session in a fresh tmux window for development work.

## Execution

```bash
tmux new-window -n "code" "cd ~/work/code && claude"
```

**Behavior:**
- Creates new tmux window named "code"
- Changes to `~/work/code` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in code workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
