---
name: Home
description: Open Claude session in home workspace for personal projects. USE WHEN /home.
---

# Home

Opens Claude Code in the home workspace for personal projects (PAI, imladris, finances, etc).

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^home$'; then
    tmux select-window -t home
    echo "Switched to existing home window"
else
    tmux new-window -n "home" "cd ~/home && claude \"\$(zone-context)\""
fi
```

**Behavior:**
- Checks if "home" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window in `~/home` directory
- ZONE=home is auto-set by direnv

## After Execution

Tell user: "Home workspace ready. Personal projects, PAI work, finances go here."
