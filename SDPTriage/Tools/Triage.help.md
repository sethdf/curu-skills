# Triage CLI Tool

AI-powered SDP ticket prioritization CLI.

## Synopsis

```bash
bun ~/.claude/skills/SDPTriage/Tools/Triage.ts [options]
```

## Description

Fetches all SDP tickets assigned to you, calculates metrics (age, response gaps, VIP status, overdue), and uses Claude AI (Sonnet) to categorize each ticket by:

1. **Priority Tier** (P0-P3)
2. **Quick Win** potential (for momentum building)

Can run standalone for cron automation or interactively for on-demand triage.

## Options

| Option | Description |
|--------|-------------|
| `--quick-wins` | Show only tickets flagged as quick wins |
| `--critical` | Show only P0 and P1 tickets |
| `--json` | Output as JSON instead of markdown |
| `--notify` | Send voice notification on completion |
| `--dry-run` | Skip AI inference, show raw ticket data |
| `--limit <n>` | Maximum tickets to process (default: 50) |
| `--quiet` | Minimal output for cron jobs |
| `--help`, `-h` | Show help message |

## Examples

### Basic triage
```bash
bun Triage.ts
```

### Quick wins only
```bash
bun Triage.ts --quick-wins
```

### Critical tickets only
```bash
bun Triage.ts --critical
```

### JSON output for scripting
```bash
bun Triage.ts --json | jq '.[] | select(.tier == "P0")'
```

### Cron job (quiet, notify)
```bash
bun Triage.ts --quiet --notify
```

### Test without AI
```bash
bun Triage.ts --dry-run --json
```

## Output

### Markdown (default)

```markdown
# Ticket Triage Report

## Quick Wins (Clear These Fast)
| ID | Subject | Est. Time | Tier | Why Quick |
|----|---------|-----------|------|-----------|
| #12360 | Password reset | 5min | P2 | Standard reset |

## P0 - Critical (Handle Immediately)
| ID | Subject | Days Open | Reason |
|----|---------|-----------|--------|
| #12345 | Server down | 3 | VIP, overdue, 52h no response |

...
```

### JSON

```json
[
  {
    "ticket_id": "12345",
    "tier": "P0",
    "quick_win": false,
    "reasoning": "VIP requester, overdue by 2 days",
    "suggested_action": "Call CFO directly",
    "estimated_time": "1hr"
  }
]
```

## Dependencies

- `auth-keeper sdp` - SDP API authentication
- `claude` CLI - AI inference (uses subscription)
- `bun` - Runtime

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (fetch failed, AI failed, etc.) |

## Cron Setup

For automated daily triage:

```bash
# Edit crontab
crontab -e

# Add daily triage at 8am
0 8 * * 1-5 cd ~/.claude/skills/SDPTriage/Tools && bun Triage.ts --quiet --notify 2>&1 | logger -t sdptriage
```
