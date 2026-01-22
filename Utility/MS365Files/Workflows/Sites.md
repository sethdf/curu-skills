# Sites Workflow

List and search SharePoint sites accessible to the user.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Listing SharePoint sites"}' \
  > /dev/null 2>&1 &
```

## Step 1: Determine Request Type

- **List all sites**: "show SharePoint sites", "what sites can I access"
- **Search for site**: "find the IT team SharePoint", "where's the HR site"
- **Site details**: "show me the drives in IT Team site"

## Step 2: Execute Commands

### List All Accessible Sites

```bash
auth-keeper ms365 "Get-MgSite -All | Select-Object DisplayName, WebUrl, Id, @{N='Created';E={\$_.CreatedDateTime.ToString('yyyy-MM-dd')}} | Sort-Object DisplayName | Format-Table -AutoSize"
```

### Search Sites by Name

```bash
auth-keeper ms365 "Get-MgSite -Search '<search-term>' | Select-Object DisplayName, WebUrl, Id | Format-Table -AutoSize"
```

### Get Site Details

```bash
# Get site info
auth-keeper ms365 "Get-MgSite -SiteId '<site-id>' | Select-Object DisplayName, Description, WebUrl, Id"

# List document libraries (drives) in site
auth-keeper ms365 "Get-MgSiteDrive -SiteId '<site-id>' | Select-Object Name, Description, @{N='Type';E={\$_.DriveType}}, Id, WebUrl | Format-Table -AutoSize"
```

### Get Site by URL

If you know the site URL (e.g., from a link someone shared):
```bash
# Format: <tenant>.sharepoint.com:/sites/<site-name>
auth-keeper ms365 "Get-MgSite -SiteId 'buxtonco.sharepoint.com:/sites/ITTeam'"
```

## Step 3: Format Output

### Sites List

```
SharePoint Sites (24 accessible):

| Site Name              | URL                                        | ID          |
|------------------------|--------------------------------------------|-------------|
| Company Intranet       | https://buxtonco.sharepoint.com/           | abc123...   |
| IT Team                | https://buxtonco.sharepoint.com/sites/IT   | def456...   |
| HR Resources           | https://buxtonco.sharepoint.com/sites/HR   | ghi789...   |
| Marketing              | https://buxtonco.sharepoint.com/sites/Mktg | jkl012...   |
```

### Site Details

```
Site: IT Team
URL: https://buxtonco.sharepoint.com/sites/IT
Description: IT department collaboration and documentation

Document Libraries:
| Library Name    | Type         | ID          |
|-----------------|--------------|-------------|
| Documents       | documentLibrary | lib123... |
| Shared Docs     | documentLibrary | lib456... |
| Project Files   | documentLibrary | lib789... |
```

## Step 4: Offer Next Actions

After listing sites:
1. **Browse site**: "Would you like to see files in any of these sites?"
2. **Search site**: "Search for files within a specific site?"
3. **Get details**: "Show more details about a site?"

After showing site details:
1. **List files**: "Show files in one of these document libraries?"
2. **Search files**: "Search for files in this site?"

## Common Site Patterns

| User Says | Command | Notes |
|-----------|---------|-------|
| "team sites" | `Get-MgSite -All` | Filter for /sites/ URLs |
| "my sites" | `Get-MgUserJoinedTeam` then sites | Sites from joined teams |
| "recent sites" | `Get-MgSite -All` | Sort by last accessed |
| "IT SharePoint" | `Get-MgSite -Search 'IT'` | Search by name |

## Caching Site Info

For frequently accessed sites, note the IDs to avoid repeated lookups:

```
# Save commonly used site IDs
IT_SITE="buxtonco.sharepoint.com,abc123-def456-..."
HR_SITE="buxtonco.sharepoint.com,ghi789-jkl012-..."

# Use directly
auth-keeper ms365 "Get-MgSiteDrive -SiteId '$IT_SITE'"
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `No sites found` | Search term too specific | Try broader search or list all |
| `Access denied` | No permission to site | Request access from site owner |
| `Site not found` | Invalid site ID or URL | Use search to find correct site |
