---
name: Security
description: Open new Claude session in security workspace. USE WHEN /security.
---

# Security

Opens a new Claude Code session in a fresh tmux window for security and reconnaissance work.

## Execution

```bash
tmux new-window -n "security" "cd ~/work/security && claude"
```

**Behavior:**
- Creates new tmux window named "security"
- Changes to `~/work/security` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in security workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
