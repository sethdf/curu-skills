# Recall Workflow

Recall a previous work session with zone-aware filtering.

## Intent-to-Flag Mapping

### Zone Selection

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "work sessions", "at work" | `--zone work` | Work context only |
| "home stuff", "personal" | `--zone home` | Home context only |
| "all", "everything", "both" | `--zone all` | Cross-zone view |
| (default) | auto-detect from cwd | Context-aware |

### Time Range

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "today" | `--days 1` | Today only |
| "yesterday" | `--days 2` | Include yesterday |
| "last few days" | `--days 3` | Short range |
| "this week", "recent" | `--days 7` | Default range |
| "everything" | `--days 30` | Extended history |

### Output Format

| User Says | Flag | When to Use |
|-----------|------|-------------|
| (default for Claude) | `--format json` | Structured data for processing |
| "show me", "list" | `--format table` | Human-readable output |
| "details", "more info" | `--verbose` | Include item summaries |

## Execution Steps

### 1. Detect Zone

Determine the current zone from `$CWD`:

| CWD Pattern | Zone |
|-------------|------|
| `/data/work/*` | WORK |
| `/data/home/*` | HOME |
| Other | ALL |

### 2. List Recent Sessions

Based on user request, construct the CLI command using the mapping tables above:

```bash
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts \
  [ZONE_FLAG_FROM_MAPPING] \
  [DAYS_FLAG_FROM_MAPPING] \
  [FORMAT_FLAG_FROM_MAPPING]
```

**Example invocations:**
```bash
# Default: auto-detect zone, last 7 days, JSON output
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts

# "Show me work sessions from yesterday"
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts --zone work --days 2 --format table

# "What was I working on today?" (from /data/home context)
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts --zone home --days 1 --format table -v
```

The tool outputs JSON with session metadata:
```json
[
  {
    "id": "20260121-060549_what-were-we-working-on",
    "title": "what were we working on",
    "created_at": "2026-01-21T06:05:49-07:00",
    "completed_at": "2026-01-21T06:08:32-07:00",
    "status": "COMPLETED",
    "zone": "HOME",
    "age": "today"
  }
]
```

### 3. Present Options

Use **AskUserQuestion** to present sessions grouped by time:

**Today:**
- [Title 1] (HH:MM) - STATUS
- [Title 2] (HH:MM) - STATUS

**Yesterday:**
- [Title 3] - STATUS

**Older:**
- [Title 4] (Jan 19) - STATUS

Include option to filter further or see more.

### 4. Load Session Context

When user selects a session:

1. Read the META.yaml from `~/.claude/MEMORY/WORK/{session_id}/`
2. Read any items from `~/.claude/MEMORY/WORK/{session_id}/items/`
3. Check for scratch/ artifacts
4. Summarize what was being worked on

### 5. Provide Resume Context

Output a summary for the user:

```
## Resuming: {title}

**When:** {timestamp}
**Status:** {status}

### What was happening:
{summary from items}

### Files involved:
{files_changed from lineage}

### Where to continue:
{recommended next steps}
```

## Time Filter Interpretation

| User Says | Days |
|-----------|------|
| "today" | 0 |
| "yesterday" | 1 |
| "this week", "recent" | 7 |
| "last few days" | 3 |
| No filter | 7 (default) |

## Zone Override

If user explicitly mentions zone:
- "work sessions" → WORK zone only
- "home stuff" → HOME zone only
- "all", "everything" → ALL zones
