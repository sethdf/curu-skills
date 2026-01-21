# ListSessions Tool

List recent work sessions for the Resume skill.

## Usage

```bash
bun ~/.claude/skills/Resume/Tools/ListSessions.ts [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--zone <work\|home\|all>` | Filter by zone | Auto-detect from cwd |
| `--days <n>` | Show sessions from last n days | 7 |
| `--format <json\|table>` | Output format | json |
| `--help` | Show help | - |

## Zone Detection

The tool automatically detects the zone from the current working directory:

| CWD Pattern | Zone |
|-------------|------|
| `/data/work/*` | WORK |
| `/data/home/*` | HOME |
| Other | ALL |

Use `--zone all` to override auto-detection and see all sessions.

## Output Formats

### JSON (default)

Returns an array of session objects:

```json
[
  {
    "id": "20260121-060549_what-were-we-working-on",
    "title": "what were we working on",
    "created_at": "2026-01-21T06:05:49-07:00",
    "completed_at": "2026-01-21T06:08:32-07:00",
    "status": "COMPLETED",
    "zone": "HOME",
    "age": "today",
    "relativePath": "20260121-060549_what-were-we-working-on"
  }
]
```

### Table

Human-readable grouped output:

```
Today
  ✓ [HOME] what were we working on (06:05)

Yesterday
  ✓ [WORK] review auth config (14:30)
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

# Today's sessions only
bun ListSessions.ts --days 1
```

## Data Source

Sessions are read from `~/.claude/MEMORY/WORK/` directories. Each session has a META.yaml file with:

- `id` - Unique identifier
- `title` - Human-readable title
- `created_at` - Session start timestamp
- `completed_at` - Session end timestamp (if completed)
- `status` - COMPLETED, IN_PROGRESS, etc.
- `session_id` - UUID linking to projects/ transcript
