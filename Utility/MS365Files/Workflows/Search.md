# Search Workflow

Search for files in OneDrive and SharePoint by name or content.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Searching for files in OneDrive and SharePoint"}' \
  > /dev/null 2>&1 &
```

## Step 1: Determine Search Scope

Ask user or infer from context:
- **OneDrive only**: Personal files in user's OneDrive
- **SharePoint site**: Files in a specific team/project site
- **Everywhere**: Search both OneDrive and accessible SharePoint sites

## Step 2: Build Search Query

Extract search terms from user request. Common patterns:
- File name: "find budget.xlsx" → `budget.xlsx`
- Partial name: "quarterly report" → `quarterly report`
- File type: "all PDFs about security" → `security .pdf`

## Step 3: Execute Search

### OneDrive Search

**Important**: OneDrive search requires the DriveId parameter. Get it first, then search.

```bash
auth-keeper ms365 "\$drives = Get-MgUserDrive -UserId 'sfoley@buxtonco.com'; \$driveId = (\$drives | Where-Object { \$_.Name -eq 'OneDrive' }).Id; Search-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -DriveId \$driveId -Q '<search-query>' | Select-Object Name, @{N='Path';E={\$_.ParentReference.Path}}, WebUrl, Id, Size, LastModifiedDateTime | Format-Table -AutoSize"
```

### SharePoint Site Search

First, identify the site:
```bash
auth-keeper ms365 "Get-MgSite -Search '<site-name>' | Select-Object DisplayName, Id, WebUrl"
```

Then search within it (note: use variable for DriveId to avoid `!` escaping issues):
```bash
auth-keeper ms365 "\$site = Get-MgSite -Search '<site-name>' | Select-Object -First 1; \$drives = Get-MgSiteDrive -SiteId \$site.Id; \$driveId = \$drives[0].Id; Search-MgDriveRoot -DriveId \$driveId -Q '<search-query>' | Select-Object Name, WebUrl, Id"
```

For known Buxton sites, use the composite SiteId format:
```bash
# IT SharePoint
auth-keeper ms365 "\$siteId = 'buxtonco.sharepoint.com,60baec84-a985-4d8c-9838-42c118f2f55c,89d4c574-4794-4f0e-bd52-acd5a7b41489'; \$drives = Get-MgSiteDrive -SiteId \$siteId; \$driveId = \$drives[0].Id; Search-MgDriveRoot -DriveId \$driveId -Q '<search-query>' | Select-Object Name, WebUrl, Id"
```

### Search Everywhere

```bash
# OneDrive
auth-keeper ms365 "\$drives = Get-MgUserDrive -UserId 'sfoley@buxtonco.com'; \$driveId = (\$drives | Where-Object { \$_.Name -eq 'OneDrive' }).Id; Search-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -DriveId \$driveId -Q '<query>' | Select-Object Name, @{N='Location';E={'OneDrive'}}, WebUrl, Id"

# All SharePoint sites (may be slow)
auth-keeper ms365 "Get-MgSite -All | ForEach-Object { \$site = \$_; Get-MgSiteDrive -SiteId \$site.Id -ErrorAction SilentlyContinue | ForEach-Object { \$driveId = \$_.Id; Search-MgDriveRoot -DriveId \$driveId -Q '<query>' -ErrorAction SilentlyContinue | Select-Object Name, @{N='Site';E={\$site.DisplayName}}, WebUrl, Id } }"
```

## Step 4: Present Results

Format results in a table showing:
- File name
- Location (OneDrive or SharePoint site name)
- Path within the drive
- Last modified date
- File ID (for download)

Example output:
```
Found 3 files matching "quarterly report":

| Name                    | Location    | Path              | Modified    | ID           |
|-------------------------|-------------|-------------------|-------------|--------------|
| Q4_Report.xlsx          | OneDrive    | /Documents/Finance| 2024-01-15  | abc123...    |
| Quarterly_Summary.docx  | IT Team     | /Shared Documents | 2024-01-10  | def456...    |
| Q3_Report_Final.pdf     | OneDrive    | /Documents/Archive| 2023-10-01  | ghi789...    |
```

## Step 5: Offer Next Actions

After showing results, offer:
1. **Download**: "Would you like me to download any of these files?"
2. **Open in browser**: "I can open the file in your browser if you prefer"
3. **Refine search**: "Would you like to search with different terms?"

If user wants to download, invoke the Download workflow with the file's ID and source (OneDrive or SharePoint site ID).
