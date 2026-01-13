# Status Workflow

Quick status check for the mail processing system.

## Prerequisites

- Mail processor at `$MAIL_PROJECT` (default: `/home/sfoley/current/mail`)
- Himalaya configured and working

## Workflow Steps

### Step 1: Check System Status

```bash
cd $MAIL_PROJECT
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts status
```

### Step 2: Report Summary

Present status in this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAIL PROCESSING STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account: [account name]
Last Sync: [timestamp]
Cached Messages: [count]

Pending Transaction: [Yes/No]
  - Transaction ID: [id]
  - Created: [timestamp]
  - Actions: [count] ([breakdown by type])
  - Status: [pending/approved/executed]

Classification Cache:
  - Messages classified: [count]
  - Categories: [breakdown]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3: Offer Next Actions

Based on status, suggest:
- If no pending transaction: "Run sync + classify to process new emails"
- If pending transaction exists: "Run /MailReview to review and approve actions"
- If transaction approved but not executed: "Ready to execute - use execute command"

## Commands Reference

```bash
# Full status
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts status

# Check logs
ls -la $MAIL_PROJECT/data/logs/

# View latest transaction
ls -t $MAIL_PROJECT/data/logs/*.json | head -1 | xargs cat | jq .
```
