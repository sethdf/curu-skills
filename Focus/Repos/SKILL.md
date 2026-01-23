---
name: Repos
description: Open new Claude session in repos workspace. USE WHEN /repos.
---

# Repos

Opens a new Claude Code session in a fresh tmux window for repository browsing.

## Execution

```bash
tmux new-window -n "repos" "cd ~/work/repos && claude"
```

**Behavior:**
- Creates new tmux window named "repos"
- Changes to `~/work/repos` directory
- Starts fresh Claude session with proper CLAUDE.md loading
- Original session continues independently

## After Execution

Tell user: "Opened new Claude session in repos workspace. Switch with `Ctrl-b n` or `Ctrl-b 1-9`."
