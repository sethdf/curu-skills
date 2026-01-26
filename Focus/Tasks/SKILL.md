---
name: Tasks
description: Open Claude session in tasks workspace for tickets, requests, changes. USE WHEN /tasks.
---

# Tasks

Opens Claude Code in the tasks workspace for tickets, requests, changes, and actionable work items.

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^tasks$'; then
    tmux select-window -t tasks
    echo "Switched to existing tasks window"
else
    tmux new-window -n "tasks" "cd ~/work/tasks && claude \"\$(cat .zone-prompt 2>/dev/null)\""
fi
```

**Behavior:**
- Checks if "tasks" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window, loads .zone-prompt as initial context
- Use for: ServiceDesk tickets, work requests, change control, any actionable items

## After Execution

Tell user: "Tasks workspace ready. Use Ctrl-b n to switch windows."
