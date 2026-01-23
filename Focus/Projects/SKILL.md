---
name: Projects
description: Open new Claude session in projects workspace. USE WHEN /projects.
---

# Projects

Opens a new Claude Code session in a fresh tmux window for long-running project work.

## Execution

```bash
tmux new-window -n "projects" "cd ~/work/projects && claude"
```

**Behavior:**
- Creates new tmux window named "projects"
- Changes to `~/work/projects` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in projects workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
