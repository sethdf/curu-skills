# ListSessions Tool

List recent work sessions for the WhereWasI skill.

## Usage

```bash
bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--zone <work\|home\|all>` | Filter by zone | Auto-detect from cwd |
| `--days <n>` | Show sessions from last n days | 7 |
| `--format <json\|table>` | Output format | json |
| `--verbose, -v` | Include full user intent | false |
| `--detail <session_id>` | Show full details for a session | - |
| `--help` | Show help | - |

## Data Source

Sessions are read from `~/.claude/projects/` JSONL transcripts. This provides:
- Accurate user intent (first real user message)
- Files modified (Edit/Write tool calls)
- Tools used during the session
- Full timestamps and message counts

## Zone Detection

The tool automatically detects the zone from the current working directory:

| CWD Pattern | Zone |
|-------------|------|
| `/data/work/*` | WORK |
| `/data/home/*` | HOME |
| Other | ALL |

Use `--zone all` to override auto-detection and see all sessions.

## Filtering

The tool automatically filters out:
- Hook-injected system messages (CONTEXT:, <system-reminder>, etc.)
- Sessions with < 5 messages (likely stub sessions)
- Sessions with no real user intent

## Output Formats

### JSON (default)

Returns an array of session objects:

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

### Table

Human-readable grouped output:

```
Today
  [HOME] what were we working on (06:05 AM) (3 files)

Yesterday
  [WORK] review auth config (02:30 PM) (7 files)
```

### Detail View

Use `--detail <session_id>` for full session information:

```
═══ Session Detail ═══

Title: what were we working on
Session ID: abc123-def456-...
Zone: HOME
Working Directory: /data/home/repos/...
Started: 1/21/2026, 6:05:49 AM
Last Activity: 1/21/2026, 6:08:32 AM
Messages: 45

User Intent:
  what were we working on yesterday?

Tools Used:
  • Bash
  • Edit
  • Read

Files Modified:
  • path/to/file.ts

Source: ~/.claude/projects/...
```

## Examples

```bash
# List sessions from auto-detected zone, last 7 days (default)
bun ListSessions.ts

# List all zones
bun ListSessions.ts --zone all

# List WORK zone only, last 3 days
bun ListSessions.ts --zone work --days 3

# Human-readable table output
bun ListSessions.ts --format table

# Include verbose user intent
bun ListSessions.ts --format table -v

# Today's sessions only
bun ListSessions.ts --days 1

# Full details for a specific session
bun ListSessions.ts --detail abc123-def456
```
