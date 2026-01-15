---
name: Comms
description: Unified communications assistant. USE WHEN user says /comms OR check messages OR inbox zero OR catch up on messages OR check email and slack OR triage communications. Aggregates MS365, Gmail, Slack, Telegram, Signal.
allowed-tools:
  - Bash
  - Read
  - Write
  - Skill
---

# Comms

Unified communications dashboard that aggregates all messaging platforms and helps maintain inbox zero.

## Priority Order

1. **MS365** (Outlook email + calendar) - Work first
2. **Gmail** (email + calendar) - Personal
3. **Slack** - Team messaging
4. **Telegram** - Personal messaging
5. **Signal** - Secure messaging

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Check** | "/comms", "check messages", "catch up" | `Workflows/Check.md` |
| **Triage** | "triage", "inbox zero", "process messages" | `Workflows/Triage.md` |
| **Reply** | "reply to", "respond to", "draft reply" | `Workflows/Reply.md` |
| **ToCalendar** | "add to calendar", "schedule this", "create event from" | `Workflows/ToCalendar.md` |

## Examples

**Example 1: Morning check-in**
```
User: "/comms"
-> Invokes Check workflow
-> Checks MS365, Gmail, Slack, Telegram, Signal in priority order
-> Returns unified summary:
   Outlook: 5 unread (2 urgent)
   Gmail: 3 unread
   Slack: 8 mentions in 3 channels
   Telegram: 2 messages
   Signal: 0 messages
```

**Example 2: Process inbox**
```
User: "Let's do inbox zero"
-> Invokes Triage workflow
-> Presents messages one by one with suggested actions
-> User approves: archive, reply, delegate, calendar, or defer
-> Tracks progress toward zero
```

**Example 3: Add meeting from email**
```
User: "Add that meeting request to my calendar"
-> Invokes ToCalendar workflow
-> Extracts event details from message
-> Creates calendar event (uses OutlookCalendar or GoogleCalendar skill)
-> Confirms creation
```

## Platform Skills

Comms delegates to platform-specific skills:

| Platform | Skill | Status |
|----------|-------|--------|
| MS365 Email | Outlook | Available |
| MS365 Calendar | OutlookCalendar | Available |
| Gmail | Gmail | Available |
| Google Calendar | GoogleCalendar | Available |
| Slack | Slack | Available |
| Telegram | Telegram | Available |
| Signal | signal-interface | Partial |
| iMessage | - | Planned |
| SMS | - | Planned |

## Quick Commands

```bash
/comms              # Full check across all platforms
/comms outlook      # Check Outlook only
/comms gmail        # Check Gmail only
/comms slack        # Check Slack only
/comms urgent       # Show only urgent/high-priority items
```
