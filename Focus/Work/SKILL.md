---
name: Work
description: Open Claude session in work workspace for main work tasks. USE WHEN /work.
---

# Work

Opens Claude Code in the work workspace for primary work tasks and projects.

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^work$'; then
    tmux select-window -t work
    echo "Switched to existing work window"
else
    tmux new-window -n "work" "cd ~/work && claude"
fi
```

**Behavior:**
- Checks if "work" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window in `~/work` directory
- ZONE=work is auto-set by direnv

## After Execution

Tell user: "Work workspace ready. Primary work tasks and projects go here."
