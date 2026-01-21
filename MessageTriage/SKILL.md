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
- **Email (MS365):** Via auth-keeper ms365 Graph API
- **Slack:** Via slackdump SQLite archive
- **Extensible:** Adapter pattern for future sources

**Thread Context Awareness:**
- Email: Analyzes full reply chains (In-Reply-To, References headers)
- Slack: Includes parent messages and thread replies
- Categorization considers conversational flow, not just individual messages

**AI Categorization:**
- Uses PAI Inference tool: `bun ~/.claude/tools/Inference.ts standard`
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

**Example 2: Categorize Slack channel**
```
User: "Categorize messages in #support from last week"
→ Invokes Triage workflow with Slack source
→ Uses slackdump archive with thread context
→ AI classifies by urgency, topic, action-needed
→ Returns actionable summary
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

# Cron-ready (every 4 hours)
0 */4 * * * bun /path/to/Tools/AutoTriage.ts --source email --notify --quiet
```

### AutoTriage CLI Options

| Flag | Description |
|------|-------------|
| `--source <email\|slack>` | Message source (required) |
| `--channel <name>` | Slack channel (for slack) |
| `--limit <n>` | Max messages (default: 100) |
| `--notify` | Send notification on completion |
| `--dry-run` | Export/categorize only, no actions |
| `--quiet` | Minimal output for cron |

**Full documentation:** `Tools/AutoTriage.help.md`

### Example: Setup Daily Email Triage

```bash
# Add to crontab
crontab -e

# Daily at 8am
0 8 * * * /usr/bin/bun /home/ubuntu/repos/github.com/sethdf/curu-skills/MessageTriage/Tools/AutoTriage.ts --source email --limit 200 --notify --quiet 2>&1 | logger -t autotriage
```

## Dependencies

**PAI Skills Used:**
- `~/.claude/skills/CORE/` - System infrastructure
- `~/.claude/tools/Inference.ts` - AI categorization (Sonnet)

**External Tools:**
- `auth-keeper` - MS365 Graph API authentication
- `slackdump` - Slack archive to SQLite
- `sqlite3` - Local message cache queries
