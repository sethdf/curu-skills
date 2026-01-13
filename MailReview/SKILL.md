---
name: MailReview
description: AI-assisted email triage review. USE WHEN reviewing email classifications OR approving mail actions OR checking pending email transactions. Integrates with mailprocessing project.
---

# MailReview

AI-assisted review of email classifications and pending actions from the mail processor.

## Configuration

```bash
# Required environment
export HIMALAYA_BIN=~/.local/bin/himalaya
export MAIL_PROJECT=/home/sfoley/current/mail
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Review** | "review emails", "check pending" | `Workflows/Review.md` |
| **Status** | "mail status", "email status" | `Workflows/Status.md` |

## Examples

**Example 1: Review pending actions**
```
User: "Review my pending email actions"
→ Invokes Review workflow
→ Shows each action with email preview
→ Allows approve/reject/skip per item
```

**Example 2: Check status**
```
User: "What's the status of my email triage?"
→ Invokes Status workflow
→ Shows sync state, classifications, pending transactions
```

**Example 3: Quick triage**
```
User: "Triage my inbox"
→ Runs sync → classify → review workflow
→ Interactive approval of suggested actions
```
