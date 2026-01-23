---
name: Adhoc
description: Open new Claude session in adhoc workspace. USE WHEN /adhoc.
---

# Adhoc

Opens a new Claude Code session in a fresh tmux window for quick one-off work.

## Execution

```bash
tmux new-window -n "adhoc" "cd ~/work/adhoc && claude"
```

**Behavior:**
- Creates new tmux window named "adhoc"
- Changes to `~/work/adhoc` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in adhoc workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
