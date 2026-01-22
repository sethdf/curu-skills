---
name: SDPTriage
description: AI-powered SDP ticket prioritization. USE WHEN triage tickets, prioritize helpdesk, which ticket next, analyze my queue, urgent tickets, OR intelligent ticket sorting. Uses AI inference to score and categorize tickets by urgency.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/SDPTriage/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SDPTriage

AI-powered ServiceDesk Plus ticket prioritization using Claude inference for intelligent categorization beyond simple scoring rules.

**Core Pattern:** Fetch Tickets → Enrich Data → AI Categorization (Sonnet) → Prioritized Report

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow from the SDPTriage skill"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow from the **SDPTriage** skill...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Triage** | "triage tickets", "prioritize my queue" | `Workflows/Triage.md` |
| **Report** | "triage report", "queue analysis" | `Workflows/Report.md` |

## Quick Reference

**Scoring Factors:**
- **Response Gap**: No response from me for 24+ hours (critical)
- **Time Open**: Age of ticket in days
- **Overdue Status**: Past due date
- **Priority**: Urgent/High/Medium/Low
- **VIP Requester**: VIP flag on requester
- **Requester Role**: C-level, manager, etc.
- **Last Update Age**: Stale ticket indicator

**AI Enhancement:**
- Uses PAI Inference tool: `bun ~/.claude/skills/CORE/Tools/Inference.ts standard`
- Considers context beyond rules (ticket patterns, requester history)
- Returns: Priority Tier (P0-P3), Reasoning, Suggested Action
- Groups by urgency for batch processing

**Full Documentation:**
- Scoring criteria: Read `ScoringCriteria.md`
- CLI usage: Read `Tools/Triage.help.md`

## Examples

**Example 1: Triage my queue**
```
User: "Triage my SDP tickets"
→ Invokes Triage workflow
→ Fetches all tickets assigned to me
→ AI categorizes each by urgency with reasoning
→ Returns prioritized list with P0 (critical) first
```

**Example 2: Find neglected tickets**
```
User: "Which tickets haven't I responded to?"
→ Invokes Triage workflow with response-gap focus
→ Identifies tickets awaiting my response 24+ hours
→ AI explains urgency and suggests response
```

**Example 3: Generate triage report**
```
User: "Show me a triage report for my queue"
→ Invokes Report workflow
→ Groups tickets by priority tier
→ Shows statistics and recommendations
```

## Priority Tiers

| Tier | Criteria | Action |
|------|----------|--------|
| **P0 Critical** | Overdue + VIP, or 48+ hours no response | Handle immediately |
| **P1 High** | Overdue, or VIP, or 24+ hours no response | Handle today |
| **P2 Medium** | Due soon, or standard priority aging | Handle this week |
| **P3 Low** | On track, low priority | Handle when able |

## Dependencies

**PAI Skills Used:**
- `~/.claude/skills/SDP/` - Backend API access via auth-keeper
- `~/.claude/skills/CORE/Tools/Inference.ts` - AI categorization

**External Tools:**
- `auth-keeper sdp` - SDP API authentication
