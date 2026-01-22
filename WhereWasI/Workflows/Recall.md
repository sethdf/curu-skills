# Recall Workflow

Recall a previous work session with zone-aware filtering and rich context.

## Data Source

Sessions are read from `~/.claude/projects/` JSONL transcripts, which contain:
- The original user request (intent)
- All tool calls and file modifications
- Full conversation context
- Accurate timestamps

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
| "details", "more info" | `--verbose` | Include full user intent |

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
    "id": "abc123-def456-...",
    "title": "what were we working on",
    "userIntent": "what were we working on yesterday?",
    "created_at": "2026-01-21T06:05:49-07:00",
    "updated_at": "2026-01-21T06:08:32-07:00",
    "zone": "HOME",
    "age": "today",
    "projectDir": "-data-home-repos-github-com-sethdf-curu-skills",
    "messageCount": 45,
    "filesModified": ["path/to/file.ts"],
    "toolsUsed": ["Bash", "Edit", "Read"],
    "cwd": "/data/home/repos/github.com/sethdf/curu-skills"
  }
]
```

### 3. Present Options

Use **AskUserQuestion** to present sessions grouped by time:

**Today:**
- [Title 1] (HH:MM) - N files modified
- [Title 2] (HH:MM) - N files modified

**Yesterday:**
- [Title 3] - N files modified

**Older:**
- [Title 4] (Jan 19) - N files modified

Include option to see more details or filter further.

### 4. Load Session Context

When user selects a session, use the `--detail` flag:

```bash
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts --detail <session_id> --format table
```

This shows:
- Session title and ID
- Zone and working directory
- Start time and last activity
- Message count
- Full user intent
- Tools used
- Files modified
- Source file path

### 5. Provide Resume Context

Output a summary for the user:

```
## Resuming: {title}

**When:** {timestamp}
**Where:** {cwd}
**Zone:** {zone}

### What you were doing:
{userIntent}

### Files involved:
{filesModified}

### Tools used:
{toolsUsed}

### Where to continue:
{recommended next steps based on context}
```

## Filtering Notes

The tool automatically filters:
- Hook-injected system messages (CONTEXT:, system-reminder, etc.)
- Very short sessions (< 5 messages) that are likely stubs
- Sessions with no real user intent

This ensures only meaningful work sessions are shown.
