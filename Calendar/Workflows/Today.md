# Today Workflow

Show today's calendar events based on current context.

## Steps

1. **Detect context**
   ```bash
   echo "Context: ${ZONE:-not set}"
   ```

2. **Route to backend**

   ### If ZONE=work (MS365)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   auth-keeper ms365 "
   \$user = 'sfoley@buxtonco.com'
   \$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddT00:00:00Z')
   \$tomorrow = (Get-Date).AddDays(1).ToUniversalTime().ToString('yyyy-MM-ddT00:00:00Z')

   Write-Host 'Today''s Schedule (Work):'
   Write-Host ''

   Get-MgUserEvent -UserId \$user -Filter \"start/dateTime ge '\$today' and start/dateTime lt '\$tomorrow'\" |
     Select-Object @{N='Time';E={\$_.Start.DateTime.Substring(11,5)}}, Subject |
     Sort-Object Time |
     Format-Table -AutoSize
   "
   ```

   ### If ZONE=home (Google Calendar)
   ```bash
   source ~/repos/github.com/sethdf/imladris/scripts/auth-keeper.sh
   echo "Today's Schedule (Home):"
   echo ""
   auth-keeper google calendar
   ```

3. **Summarize**
   - Note any conflicts or back-to-back meetings
   - Highlight important events
   - Mention available gaps
