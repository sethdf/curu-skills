---
name: Comms
description: Unified communications assistant. USE WHEN user says /comms OR check messages OR inbox zero OR catch up on messages OR check email and slack OR triage communications. Aggregates MS365, Gmail, Slack, Telegram, Signal.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/Comms/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Comms

Unified communications dashboard that aggregates all messaging platforms and helps maintain inbox zero.

## Priority Order

1. **Mail** (context-aware: MS365 or Gmail via auth-keeper)
2. **Calendar** (context-aware: MS365 or Google via auth-keeper)
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

Comms delegates to context-aware skills:

| Platform | Skill | Backend |
|----------|-------|---------|
| Email | Mail | auth-keeper (MS365 or Gmail based on ZONE) |
| Calendar | Calendar | auth-keeper (MS365 or Google based on ZONE) |
| Slack | Slack | Slack API |
| Telegram | Telegram | Telegram Bot API |
| Signal | signal-interface | signal-cli |
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
