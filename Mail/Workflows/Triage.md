# Triage Workflow

Email triage based on current context.

## Steps

1. **Detect context**
   ```bash
   echo "Context: ${CONTEXT:-not set}"
   ```

2. **Route to backend**

   ### If CONTEXT=work (MS365)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   auth-keeper ms365 "
   \$user = 'sfoley@buxtonco.com'
   \$unread = Get-MgUserMessage -UserId \$user -Filter 'isRead eq false' -CountVariable count -Top 1
   Write-Host \"Unread: \$count\"
   Write-Host ''
   Get-MgUserMessage -UserId \$user -Filter 'isRead eq false' -Top 10 |
     Select-Object @{N='Time';E={\$_.ReceivedDateTime.ToString('MM-dd HH:mm')}},
                   @{N='From';E={\$_.From.EmailAddress.Name.Substring(0, [Math]::Min(25, \$_.From.EmailAddress.Name.Length))}},
                   @{N='Subject';E={\$_.Subject.Substring(0, [Math]::Min(45, \$_.Subject.Length))}} |
     Format-Table -AutoSize
   "
   ```

   ### If CONTEXT=home (Gmail)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   auth-keeper google mail
   ```

3. **Summarize findings**
   - Report unread count
   - Highlight urgent/important messages
   - Suggest actions (archive, reply, etc.)
