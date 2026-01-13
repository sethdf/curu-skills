# Review Workflow

Interactive AI-assisted review of email classifications and pending actions.

## Prerequisites

- Mail processor at `$MAIL_PROJECT` (default: `/home/sfoley/current/mail`)
- Himalaya configured and working
- AWS credentials for Bedrock (classification)

## Workflow Steps

### Step 1: Check for Pending Transaction

```bash
cd $MAIL_PROJECT
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts status
```

If no pending transaction exists, offer to run sync + classify first.

### Step 2: Load Classifications and Transaction

Read the classification results:
```bash
cat $MAIL_PROJECT/data/cache/classifications.json
```

Read the pending transaction (find latest):
```bash
ls -t $MAIL_PROJECT/data/logs/*.json | head -1 | xargs cat
```

### Step 3: Interactive Review

For each action in the transaction, present:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION 1 of N: [MOVE/DELETE/FLAG]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
From: [sender]
Subject: [subject]
Date: [date]

Preview:
[first 200 chars of body]

Classification: [CATEGORY] (confidence: XX%)
Suggested Action: [action] → [target]
Reasoning: [AI reasoning]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask user:
- **Approve** this action
- **Reject** this action (remove from plan)
- **Skip** (keep in plan, decide later)
- **Show full email** (fetch complete body)
- **Reclassify** (ask AI to reconsider)

### Step 4: Fetch Email Content on Demand

When user asks to see full email:
```bash
HIMALAYA_BIN=~/.local/bin/himalaya himalaya message read [ID] --account home --preview
```

### Step 5: Build Modified Action Plan

Track user decisions:
- Approved actions → keep in plan
- Rejected actions → remove from plan
- Skipped actions → keep for later review

### Step 6: Save and Execute

After review:
1. Update transaction with approved actions only
2. Ask: "Execute N approved actions? (dry-run / real / cancel)"
3. If real execution requested, run with `--dry-run=false`

## Safety Rules

**CRITICAL:**
- DELETE actions require explicit "yes, delete" confirmation
- Always show email content before DELETE approval
- Never auto-approve based on confidence alone
- Log all decisions to transaction file

## Commands Reference

```bash
# Sync new emails
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts sync --account home --limit 50

# Classify
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts classify

# Show plan
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts plan --show

# Execute (dry-run)
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts execute

# Execute (real)
HIMALAYA_BIN=~/.local/bin/himalaya bun run src/index.ts execute --dry-run=false
```
