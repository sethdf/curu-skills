---
name: Changes
description: Open new Claude session in changes workspace. USE WHEN /changes.
---

# Changes

Opens a new Claude Code session in a fresh tmux window for change control work.

## Execution

```bash
tmux new-window -n "changes" "cd ~/work/changes && claude"
```

**Behavior:**
- Creates new tmux window named "changes"
- Changes to `~/work/changes` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in changes workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
