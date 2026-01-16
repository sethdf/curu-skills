# Check Workflow

Aggregate unread/pending messages from all communication platforms.

## Steps

1. **Check platforms in priority order:**

   ```
   For each platform (Mail -> Slack -> Telegram -> Signal):
     - Use auth-keeper or platform skill to get unread count
     - Capture urgent/high-priority items
     - Note any errors (platform unavailable, auth expired)
   ```

2. **Aggregate results:**

   ```
   Build unified summary:
   - Total unread across all platforms
   - Breakdown by platform
   - Urgent items highlighted
   - Oldest unread age
   ```

3. **Present summary:**

   ```
   ## Communications Summary

   **Email (Work/MS365):** X unread (Y urgent)
   **Email (Home/Gmail):** X unread
   **Slack:** X mentions in Y channels
   **Telegram:** X messages
   **Signal:** X messages

   ### Urgent Items
   - [Platform] From: sender - Subject/preview

   ### Recommended Actions
   - Start with urgent work email
   - Then process Slack mentions
   ```

## Platform Invocation

Use auth-keeper for email, skills for messaging:

### Email (via auth-keeper)
```bash
# Work (MS365)
source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
auth-keeper ms365 "Get-MgUserMessage -UserId 'sfoley@buxtonco.com' -Filter 'isRead eq false' -CountVariable c -Top 1; Write-Host \"MS365 Unread: \$c\""

# Home (Gmail)
auth-keeper google mail
```

### Messaging (via skills)
- Skill(slack) or `/slack unread`
- Skill(telegram) or `/telegram unread`
- Signal: `~/bin/signal-interface status`

## Error Handling

If a platform fails:
- Note the error in summary
- Continue with other platforms
- Suggest remediation (re-auth, check config)
