---
name: MS365Files
description: OneDrive and SharePoint file retrieval via auth-keeper. USE WHEN finding files in OneDrive OR downloading from SharePoint OR listing cloud files OR searching MS365 documents OR retrieving work files locally.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/MS365Files/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# MS365Files

Find and retrieve files from OneDrive and SharePoint (MS365) to local storage. Uses auth-keeper ms365 backend with Microsoft Graph PowerShell.

## Quick Reference

```bash
# User ID for all commands
$userId = 'sfoley@buxtonco.com'

# Get OneDrive drive ID (required for most operations)
auth-keeper ms365 "\$drives = Get-MgUserDrive -UserId '$userId'; \$driveId = (\$drives | Where-Object { \$_.Name -eq 'OneDrive' }).Id; Write-Host \$driveId"

# List OneDrive root files
auth-keeper ms365 "\$drives = Get-MgUserDrive -UserId '$userId'; \$driveId = (\$drives | Where-Object { \$_.Name -eq 'OneDrive' }).Id; Get-MgUserDriveRootChild -UserId '$userId' -DriveId \$driveId | Select-Object Name, Id, Size, LastModifiedDateTime"

# Search OneDrive
auth-keeper ms365 "\$drives = Get-MgUserDrive -UserId '$userId'; \$driveId = (\$drives | Where-Object { \$_.Name -eq 'OneDrive' }).Id; Search-MgUserDriveRoot -UserId '$userId' -DriveId \$driveId -Q 'quarterly report' | Select-Object Name, WebUrl, Id"

# List SharePoint sites
auth-keeper ms365 "Get-MgSite -All | Select-Object DisplayName, WebUrl, Id"

# Search SharePoint site
auth-keeper ms365 "\$siteId = 'buxtonco.sharepoint.com:/sites/Buxton-IT'; \$drives = Get-MgSiteDrive -SiteId \$siteId; \$driveId = \$drives[0].Id; Search-MgDriveRoot -DriveId \$driveId -Q 'report' | Select-Object Name, WebUrl, Id"

# Download file to local
bun ~/.claude/skills/MS365Files/Tools/Download.ts --item-id <id> --output ~/WORK/scratch/
```

## Default Download Location

Files download to `~/WORK/scratch/` by default. Override with `--output` flag.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Search** | "find file", "search OneDrive", "look for document" | `Workflows/Search.md` |
| **Download** | "download file", "get file locally", "retrieve document" | `Workflows/Download.md` |
| **List** | "list files", "show folder", "browse OneDrive" | `Workflows/List.md` |
| **Sites** | "list SharePoint sites", "show team sites" | `Workflows/Sites.md` |

## Examples

**Example 1: Search for a document**
```
User: "Find the quarterly budget spreadsheet in OneDrive"
--> Invokes Search workflow
--> Runs Search-MgUserDriveRoot with query
--> Returns matching files with names, paths, and IDs
```

**Example 2: Download a file**
```
User: "Download the Q4 report from OneDrive"
--> Invokes Search workflow to find file
--> Invokes Download workflow with item ID
--> Downloads to ~/WORK/scratch/
--> Reports: "Downloaded Q4_Report.xlsx to ~/WORK/scratch/Q4_Report.xlsx"
```

**Example 3: Browse SharePoint**
```
User: "Show me what's in the IT team SharePoint"
--> Invokes Sites workflow to find IT site
--> Invokes List workflow to show document library contents
--> Returns file listing with names and sizes
```

## PowerShell Command Reference

### OneDrive Commands

```powershell
# Get user's drives (OneDrive and PersonalCache)
$drives = Get-MgUserDrive -UserId 'sfoley@buxtonco.com'
$driveId = ($drives | Where-Object { $_.Name -eq 'OneDrive' }).Id

# Get drive root info
Get-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -DriveId $driveId

# List root folder contents (NOTE: command is RootChild, not RootChildren)
Get-MgUserDriveRootChild -UserId 'sfoley@buxtonco.com' -DriveId $driveId |
  Select-Object Name, Size, LastModifiedDateTime, Id

# List subfolder contents by item ID
Get-MgUserDriveItemChild -UserId 'sfoley@buxtonco.com' -DriveId $driveId -DriveItemId '<folder-id>' |
  Select-Object Name, Size, LastModifiedDateTime, Id

# Search files (REQUIRES DriveId parameter)
Search-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -DriveId $driveId -Q 'budget 2024' |
  Select-Object Name, WebUrl, Id, @{N='Path';E={$_.ParentReference.Path}}

# Get file by ID
Get-MgUserDriveItem -UserId 'sfoley@buxtonco.com' -DriveId $driveId -DriveItemId '<item-id>'

# Download file content
Get-MgUserDriveItemContent -UserId 'sfoley@buxtonco.com' -DriveId $driveId -DriveItemId '<item-id>' -OutFile './localfile.xlsx'
```

### SharePoint Commands

```powershell
# List all accessible sites
Get-MgSite -All | Select-Object DisplayName, WebUrl, Id

# Search sites by name
Get-MgSite -Search 'IT Team' | Select-Object DisplayName, WebUrl, Id

# Get specific site by URL path
$siteId = 'buxtonco.sharepoint.com:/sites/Buxton-IT'
$site = Get-MgSite -SiteId $siteId

# Get site by composite ID (domain,site-id,web-id)
$siteId = 'buxtonco.sharepoint.com,60baec84-a985-4d8c-9838-42c118f2f55c,89d4c574-4794-4f0e-bd52-acd5a7b41489'

# List site's document libraries (drives)
Get-MgSiteDrive -SiteId $siteId | Select-Object Name, Id, WebUrl

# List files in a document library root
$drives = Get-MgSiteDrive -SiteId $siteId
$driveId = $drives[0].Id
Get-MgDriveItemChild -DriveId $driveId -DriveItemId 'root' |
  Select-Object Name, Size, LastModifiedDateTime, Id

# Search within a SharePoint drive (use dynamic driveId, NOT literal with !)
$drives = Get-MgSiteDrive -SiteId $siteId
$driveId = $drives[0].Id
Search-MgDriveRoot -DriveId $driveId -Q 'project plan' |
  Select-Object Name, WebUrl, Id

# Download from SharePoint
Get-MgDriveItemContent -DriveId $driveId -DriveItemId '<item-id>' -OutFile './localfile.docx'
```

### Important Notes

1. **DriveId with `!` character**: When drive IDs contain `!` (e.g., `b!abc123...`), always use variables to hold them. Literal strings with `!` cause PowerShell history expansion issues.

2. **Command naming**: Use `Get-MgUserDriveRootChild` (singular), NOT `Get-MgUserDriveRootChildren` (doesn't exist).

3. **Search requires DriveId**: `Search-MgUserDriveRoot` requires `-DriveId` parameter, not just `-UserId`.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Resource not found` | Invalid path or item ID | Verify path exists, use Search to find correct ID |
| `Access denied` | No permission to site/file | Request access from site owner |
| `BWS not available` | Bitwarden Secrets not initialized | Run `bws login` |
| `The term 'Get-MgUserDrive' is not recognized` | Graph module not loaded | auth-keeper handles this automatically |
