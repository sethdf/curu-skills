---
name: Tickets
description: Open new Claude session in tickets workspace. USE WHEN /tickets.
---

# Tickets

Opens a new Claude Code session in a fresh tmux window for ServiceDesk Plus ticket work.

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^tickets$'; then
    tmux select-window -t tickets
    echo "Switched to existing tickets window"
else
    tmux new-window -n "tickets" "cd ~/work/tickets && claude"
fi
```

**Behavior:**
- Checks if "tickets" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window in `~/work/tickets` directory
- Use for: ServiceDesk Plus ticket work, support requests

## After Execution

Tell user: "Tickets workspace ready. ServiceDesk Plus and support work goes here."
