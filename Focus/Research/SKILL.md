---
name: Research
description: Open Claude session in research workspace for investigation. USE WHEN /research.
---

# Research

Opens Claude Code in the research workspace for investigation, learning, and exploration.

## Execution

```bash
# Switch to existing window or create new one
if tmux list-windows -F '#{window_name}' 2>/dev/null | grep -q '^research$'; then
    tmux select-window -t research
    echo "Switched to existing research window"
else
    tmux new-window -n "research" "cd ~/work/research && claude"
fi
```

**Behavior:**
- Checks if "research" window already exists
- If exists: switches to it (prevents duplicates)
- If not: creates new window in `~/work/research` directory
- Use for: documentation lookup, learning, investigation

## After Execution

Tell user: "Research workspace ready. Investigation, learning, and exploration go here."
