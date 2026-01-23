---
name: Tickets
description: Open new Claude session in tickets workspace. USE WHEN /tickets.
---

# Tickets

Opens a new Claude Code session in a fresh tmux window for ServiceDesk Plus ticket work.

## Execution

```bash
tmux new-window -n "tickets" "cd ~/work/tickets && claude"
```

**Behavior:**
- Creates new tmux window named "tickets"
- Changes to `~/work/tickets` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in tickets workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
