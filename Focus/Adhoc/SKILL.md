---
name: Adhoc
description: Open new Claude session in adhoc workspace. USE WHEN /adhoc.
---

# Adhoc

Opens a new Claude Code session in a fresh tmux window for quick one-off work.

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^adhoc$'; then
    tmux select-window -t adhoc
    echo "Switched to existing adhoc window"
else
    tmux new-window -n "adhoc" "cd ~/work/adhoc && claude \"\$(zone-context)\""
fi
```

**Behavior:**
- Checks if "adhoc" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window in `~/work/adhoc` directory
- Use for: quick one-off questions, temporary work

## After Execution

Tell user: "Adhoc workspace ready. Quick questions and temporary work goes here."
