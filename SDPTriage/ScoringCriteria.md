# Scoring Criteria

Detailed documentation of how SDPTriage prioritizes tickets.

## Overview

SDPTriage uses a two-dimensional categorization:

1. **Priority Tiers (P0-P3)** - Urgency of handling
2. **Quick Win Flag** - Ease of resolution

These are independent dimensions. A P0 ticket can be a quick win (urgent AND easy), or a P3 ticket can require complex investigation (low priority but hard).

## Priority Tier Criteria

### P0 - Critical (Handle Immediately)

**Must have at least one:**
- Overdue AND VIP requester
- 48+ hours awaiting response from technician
- Business-critical impact mentioned in subject/description
- C-level or executive requester
- Marked "Urgent" priority AND overdue

**Action:** Drop everything, handle now.

### P1 - High (Handle Today)

**Must have at least one:**
- Overdue (past due date)
- VIP requester (any status)
- 24-48 hours awaiting response
- "High" priority in SDP
- Manager or director requester

**Action:** Complete before end of day.

### P2 - Medium (Handle This Week)

**Characteristics:**
- Due within 3 days
- 12-24 hours since last update
- Medium priority in SDP
- Standard employee requester
- No urgency signals

**Action:** Schedule for this week.

### P3 - Low (Handle When Able)

**Characteristics:**
- On track (not overdue, not due soon)
- Low priority in SDP
- Recently updated
- No response pressure
- Non-urgent request type

**Action:** Handle when queue permits.

## Quick Win Criteria

Quick Wins are identified separately from priority. A ticket is a Quick Win if:

### Indicators

| Indicator | Examples |
|-----------|----------|
| **Simple Request** | Password reset, account unlock, access grant |
| **Known Solution** | Documented fix, KB article exists |
| **Low Complexity** | Single action resolves it |
| **Fast Turnaround** | < 15 minutes to complete |
| **Clear Path** | Obvious next step, no investigation |

### Time Estimates

| Estimate | Criteria |
|----------|----------|
| 5min | Single click/command (password reset, unlock) |
| 15min | Simple configuration (access grant, setting change) |
| 30min | Minor troubleshooting (restart, cache clear) |
| 1hr | Moderate investigation or multi-step |
| 2hr+ | Complex troubleshooting or project-level |

### Quick Win Strategy

**Recommended approach:**
1. Start day with quick wins (builds momentum, clears count)
2. Tackle P0/P1 after quick win burst
3. Batch similar quick wins together
4. Don't let quick wins distract from critical issues

## Input Factors

The AI considers these data points:

### Primary Factors

| Factor | Weight | Source |
|--------|--------|--------|
| Response Gap | Critical | `hours_awaiting_response` |
| Overdue Status | High | `is_overdue`, `days_overdue` |
| Priority Field | High | SDP priority (Urgent/High/Medium/Low) |
| VIP Status | High | Requester VIP flag |
| Requester Role | Medium | Department, job title |

### Secondary Factors

| Factor | Weight | Source |
|--------|--------|--------|
| Age | Low | `days_open` |
| Subject Keywords | Medium | Parsed from subject line |
| Department | Low | Requester department |
| Status | Low | Open, In Progress, etc. |

### Keywords Affecting Classification

**Urgency Boosters:**
- "down", "broken", "not working", "urgent", "ASAP"
- "production", "critical", "emergency"
- C-level titles: "CEO", "CFO", "CTO", "VP"

**Quick Win Indicators:**
- "password", "reset", "unlock", "access"
- "install", "setup", "request"
- "permission", "grant", "add user"

**Complexity Indicators:**
- "investigate", "troubleshoot", "intermittent"
- "multiple users", "entire department"
- "migration", "upgrade", "project"

## AI Prompt

The AI receives:

1. **System prompt** - Tier definitions and Quick Win criteria
2. **User prompt** - JSON array of ticket metrics

The AI returns for each ticket:
- `tier`: P0/P1/P2/P3
- `quick_win`: true/false
- `quick_win_reason`: Explanation (if quick win)
- `reasoning`: Why this tier
- `suggested_action`: Next step
- `estimated_time`: Time to resolve

## Tuning

To adjust scoring:

1. **Modify tier thresholds** - Edit Triage workflow system prompt
2. **Add quick win patterns** - Add keywords to system prompt
3. **Weight factors differently** - Adjust emphasis in prompt
4. **Custom categories** - Add new tiers if needed (e.g., P0.5 for escalations)

## Examples

### P0 + Not Quick Win
```
Ticket: "Production server unresponsive"
- VIP: Yes (CFO opened it)
- Overdue: Yes (2 days)
- Response gap: 52 hours
→ P0 (critical urgency)
→ Not quick win (investigation needed)
```

### P2 + Quick Win
```
Ticket: "Need password reset for John"
- VIP: No
- Overdue: No
- Priority: Medium
→ P2 (standard urgency)
→ Quick Win (5 min, known process)
```

### P1 + Quick Win
```
Ticket: "VIP needs software installed"
- VIP: Yes (Director)
- Overdue: No
- Priority: High
→ P1 (VIP, high priority)
→ Quick Win (15 min, standard install)
```
