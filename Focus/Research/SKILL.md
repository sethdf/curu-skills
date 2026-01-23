---
name: Research
description: Open new Claude session in research workspace. USE WHEN /research.
---

# Research

Opens a new Claude Code session in a fresh tmux window for deep research sessions.

## Execution

```bash
tmux new-window -n "research" "cd ~/work/research && claude"
```

**Behavior:**
- Creates new tmux window named "research"
- Changes to `~/work/research` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in research workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
