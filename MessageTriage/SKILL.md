---
name: MessageTriage
description: Universal message triage with AI categorization and thread context awareness. USE WHEN triage messages, categorize emails, triage inbox, sort slack messages, message classification, bulk categorization, OR intelligent message sorting from any source.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/MessageTriage/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# MessageTriage

Universal message triage system with AI-powered categorization. Handles messages from any source (Email, Slack, etc.) with thread context awareness for accurate classification.

**Core Pattern:** Export → Local Cache (SQLite) → AI Categorization (Sonnet) → Report/Apply

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow from the MessageTriage skill"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow from the **MessageTriage** skill...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Triage** | "triage messages", "categorize inbox" | `Workflows/Triage.md` |
| **Export** | "export messages", "cache emails locally" | `Workflows/Export.md` |
| **Categorize** | "categorize with AI", "classify messages" | `Workflows/Categorize.md` |
| **CronSetup** | "automate triage", "schedule triage", "setup cron" | `Workflows/CronSetup.md` |

## Quick Reference

**Supported Sources:**
- **Email (MS365):** Via auth-keeper ms365 Graph API (5-min polling)
- **Slack:** Via Socket Mode real-time WebSocket (instant)
- **Extensible:** Adapter pattern for future sources

**Data Architecture:**
```
Email:  auth-keeper → 5-min cron → ~/.cache/message-triage/messages.sqlite
Slack:  Socket Mode → real-time  → ~/slack-data/messages.db (primary)
        Slackdump   → hourly     → ~/slack-archive/slackdump.sqlite (historical)
```

**Thread Context Awareness:**
- Email: Analyzes full reply chains (ConversationId, In-Reply-To headers)
- Slack: Includes parent messages and thread replies (thread_ts)
- Categorization considers conversational flow, not just individual messages

**AI Categorization:**
- Uses PAI Inference tool: `bun ~/.claude/skills/CORE/Tools/Inference.ts standard`
- Returns: Category, Confidence (1-10), Reasoning
- Configurable categories per source

**Full Documentation:**
- Thread handling: Read `ThreadContext.md`
- Source adapters: Read `Adapters.md`

## Examples

**Example 1: Triage email inbox**
```
User: "Triage my inbox"
→ Invokes Triage workflow
→ Exports unread emails with thread context
→ AI categorizes each message with confidence scores
→ Returns categorized summary for bulk action approval
```

**Example 2: Triage Slack messages**
```
User: "Triage my Slack messages"
→ Invokes Triage workflow with Slack source
→ Queries real-time DB (~/slack-data/messages.db)
→ Prioritizes: DMs → Group DMs → Threads → Channels
→ AI classifies by urgency, topic, action-needed
→ Returns actionable summary grouped by priority
```

**Example 3: Export for review**
```
User: "Export my unread emails for AI categorization"
→ Invokes Export workflow
→ Fetches messages with full thread context
→ Caches to local SQLite for offline review
→ Returns cache location and message count
```

## Automated Triage (Cron/Agent)

**Standalone CLI for headless execution - no Claude Code session required.**

```bash
# Quick test
bun Tools/AutoTriage.ts --source email --limit 10 --dry-run --verbose

# Instant cached results (default for interactive)
bun Tools/AutoTriage.ts --source email --cached
```

### AutoTriage CLI Options

| Flag | Description |
|------|-------------|
| `--source <email\|slack>` | Message source (required) |
| `--cached` | Query cached results only (instant) |
| `--fresh` | Force fresh export + AI categorization |
| `--channel <name>` | Slack channel (for slack) |
| `--limit <n>` | Max messages (default: 100) |
| `--notify` | Send notification on completion |
| `--dry-run` | Export/categorize only, no actions |
| `--quiet` | Minimal output for cron |

**Full documentation:** `Tools/AutoTriage.help.md`

### Background Data Collection

| Source | Method | Frequency |
|--------|--------|-----------|
| Email | Cron polling | Every 5 minutes |
| Slack | Socket Mode | Real-time (systemd service) |

```bash
# Install email cron (Slack is already real-time via Socket Mode)
sudo cp Tools/autotriage.cron /etc/cron.d/autotriage
sudo chmod 644 /etc/cron.d/autotriage
```

## Dependencies

**PAI Skills Used:**
- `~/.claude/skills/CORE/` - System infrastructure
- `~/.claude/skills/CORE/Tools/Inference.ts` - AI categorization (Sonnet)

**External Tools:**
- `auth-keeper` - MS365 Graph API authentication
- `slack-socket-listener` - Real-time Slack messages (systemd)
- `slackdump` - Slack archive backup (hourly cron)
- `sqlite3` - Local message cache queries
