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

# OneDrive root
auth-keeper ms365 "Get-MgUserDriveRoot -UserId '$userId'"

# List OneDrive files
auth-keeper ms365 "Get-MgUserDriveRootChildren -UserId '$userId' | Select-Object Name, Size, LastModifiedDateTime"

# Search OneDrive
auth-keeper ms365 "Search-MgUserDriveRoot -UserId '$userId' -Q 'quarterly report' | Select-Object Name, WebUrl"

# List SharePoint sites
auth-keeper ms365 "Get-MgSite -All | Select-Object DisplayName, WebUrl"

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
# Get user's drive info
Get-MgUserDrive -UserId 'sfoley@buxtonco.com'

# Get drive root
Get-MgUserDriveRoot -UserId 'sfoley@buxtonco.com'

# List root folder contents
Get-MgUserDriveRootChildren -UserId 'sfoley@buxtonco.com' |
  Select-Object Name, Size, LastModifiedDateTime, Id

# List subfolder contents (by path)
Get-MgUserDriveItemByPath -UserId 'sfoley@buxtonco.com' -Path ':/Documents:' |
  Get-MgUserDriveItemChildren -UserId 'sfoley@buxtonco.com'

# Search files
Search-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -Q 'budget 2024' |
  Select-Object Name, WebUrl, Id, @{N='Path';E={$_.ParentReference.Path}}

# Get file by ID
Get-MgUserDriveItem -UserId 'sfoley@buxtonco.com' -DriveItemId '<item-id>'

# Download file content
Get-MgUserDriveItemContent -UserId 'sfoley@buxtonco.com' -DriveItemId '<item-id>' -OutFile './localfile.xlsx'
```

### SharePoint Commands

```powershell
# List all accessible sites
Get-MgSite -All | Select-Object DisplayName, WebUrl, Id

# Search sites by name
Get-MgSite -Search 'IT Team' | Select-Object DisplayName, WebUrl, Id

# Get specific site by URL
Get-MgSite -SiteId 'buxtonco.sharepoint.com:/sites/ITTeam'

# List site's document libraries (drives)
Get-MgSiteDrive -SiteId '<site-id>' | Select-Object Name, Id, WebUrl

# List files in a document library
Get-MgSiteDriveRootChildren -SiteId '<site-id>' -DriveId '<drive-id>' |
  Select-Object Name, Size, LastModifiedDateTime, Id

# Search within a site
Search-MgSiteDriveRoot -SiteId '<site-id>' -DriveId '<drive-id>' -Q 'project plan'

# Download from SharePoint
Get-MgSiteDriveItemContent -SiteId '<site-id>' -DriveId '<drive-id>' -DriveItemId '<item-id>' -OutFile './localfile.docx'
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Resource not found` | Invalid path or item ID | Verify path exists, use Search to find correct ID |
| `Access denied` | No permission to site/file | Request access from site owner |
| `BWS not available` | Bitwarden Secrets not initialized | Run `bws login` |
| `The term 'Get-MgUserDrive' is not recognized` | Graph module not loaded | auth-keeper handles this automatically |
