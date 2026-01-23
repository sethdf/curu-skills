---
name: General
description: Open new Claude session in general workspace. USE WHEN /general.
---

# General

Opens a new Claude Code session in a fresh tmux window for general admin work (email, calendar, misc).

## Execution

```bash
tmux new-window -n "general" "cd ~/work/general && claude"
```

**Behavior:**
- Creates new tmux window named "general"
- Changes to `~/work/general` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in general workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
