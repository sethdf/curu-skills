---
name: Tasks
description: Open Claude session in tasks workspace for tickets, requests, changes. USE WHEN /tasks.
---

# Tasks

Opens Claude Code in the tasks workspace for tickets, requests, changes, and actionable work items.

## Execution

```bash
# Allow up to 3 task windows, then cycle
windows=$(tmux list-windows -F '#{window_name}' 2>/dev/null)

if ! echo "$windows" | grep -q '^tasks$'; then
    tmux new-window -n "tasks" "cd ~/work/tasks && claude \"\$(zone-context)\""
    echo "Created tasks window (1/3)"
elif ! echo "$windows" | grep -q '^tasks-2$'; then
    tmux new-window -n "tasks-2" "cd ~/work/tasks && claude \"\$(zone-context)\""
    echo "Created tasks-2 window (2/3)"
elif ! echo "$windows" | grep -q '^tasks-3$'; then
    tmux new-window -n "tasks-3" "cd ~/work/tasks && claude \"\$(zone-context)\""
    echo "Created tasks-3 window (3/3)"
else
    tmux select-window -t tasks
    echo "All 3 task windows exist. Switched to tasks. Use Ctrl-b n/p to cycle."
fi
```

**Behavior:**
- Allows up to 3 concurrent task windows: tasks, tasks-2, tasks-3
- Each /tasks invocation creates the next available window
- When all 3 exist, switches to the first one
- Use for: ServiceDesk tickets, work requests, change control, any actionable items
- Tip: Use Ctrl-b n/p to cycle between windows, Ctrl-b & to close one

## After Execution

Tell user: "Tasks workspace ready. Use Ctrl-b n to switch windows."
