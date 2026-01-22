# List Workflow

List files in an OneDrive folder or SharePoint document library.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Listing files from cloud storage"}' \
  > /dev/null 2>&1 &
```

## Step 1: Determine Location

Identify what the user wants to browse:
- **OneDrive root**: "show my OneDrive files"
- **OneDrive folder**: "list files in Documents/Projects"
- **SharePoint library**: "show files in IT Team SharePoint"

## Step 2: Execute List Command

### OneDrive Root

```bash
auth-keeper ms365 "Get-MgUserDriveRootChildren -UserId 'sfoley@buxtonco.com' | Select-Object Name, @{N='Type';E={if(\$_.Folder){'Folder'}else{'File'}}}, @{N='Size';E={if(\$_.Size){\$_.Size}else{'-'}}}, LastModifiedDateTime, Id | Sort-Object Type, Name | Format-Table -AutoSize"
```

### OneDrive Subfolder (by path)

```bash
# First get the folder item
auth-keeper ms365 "\$folder = Get-MgUserDriveItemByPath -UserId 'sfoley@buxtonco.com' -Path ':/<folder-path>:'; Get-MgUserDriveItemChildren -UserId 'sfoley@buxtonco.com' -DriveItemId \$folder.Id | Select-Object Name, @{N='Type';E={if(\$_.Folder){'Folder'}else{'File'}}}, Size, LastModifiedDateTime, Id | Format-Table -AutoSize"
```

Example paths:
- `/Documents` → `:/Documents:`
- `/Documents/Projects` → `:/Documents/Projects:`
- `/Work/Reports/2024` → `:/Work/Reports/2024:`

### SharePoint Document Library

First identify the site and drive:
```bash
# Get site
auth-keeper ms365 "Get-MgSite -Search '<site-name>' | Select-Object DisplayName, Id, WebUrl"

# Get drives (document libraries) in site
auth-keeper ms365 "Get-MgSiteDrive -SiteId '<site-id>' | Select-Object Name, Id"

# List files in drive root
auth-keeper ms365 "Get-MgSiteDriveRootChildren -SiteId '<site-id>' -DriveId '<drive-id>' | Select-Object Name, @{N='Type';E={if(\$_.Folder){'Folder'}else{'File'}}}, Size, LastModifiedDateTime, Id | Format-Table -AutoSize"
```

### SharePoint Subfolder

```bash
auth-keeper ms365 "\$folder = Get-MgSiteDriveItemByPath -SiteId '<site-id>' -DriveId '<drive-id>' -Path ':/<folder-path>:'; Get-MgSiteDriveItemChildren -SiteId '<site-id>' -DriveId '<drive-id>' -DriveItemId \$folder.Id | Select-Object Name, @{N='Type';E={if(\$_.Folder){'Folder'}else{'File'}}}, Size, LastModifiedDateTime, Id | Format-Table -AutoSize"
```

## Step 3: Format Output

Present results in a clean table:

```
OneDrive: /Documents/Projects

| Type   | Name                  | Size     | Modified    | ID          |
|--------|----------------------|----------|-------------|-------------|
| Folder | Active               | -        | 2024-01-20  | abc123...   |
| Folder | Archive              | -        | 2024-01-15  | def456...   |
| File   | ProjectPlan.xlsx     | 245 KB   | 2024-01-18  | ghi789...   |
| File   | Requirements.docx    | 89 KB    | 2024-01-17  | jkl012...   |
```

## Step 4: Offer Navigation

After listing, offer:
1. **Enter folder**: "Would you like to see inside any of these folders?"
2. **Download file**: "Would you like to download any file?"
3. **Go up**: "Go back to parent folder?"
4. **Search**: "Search within this folder?"

## Common Folder Paths

| User Request | OneDrive Path |
|--------------|---------------|
| "my documents" | `:/Documents:` |
| "desktop files" | `:/Desktop:` |
| "downloads" | `:/Downloads:` |
| "pictures" | `:/Pictures:` |
| "root" or "home" | (use root command) |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Path not found` | Folder doesn't exist | List parent folder to verify path |
| `Resource not found` | Invalid site or drive ID | Use Sites workflow to get correct IDs |
| `Empty result` | Folder is empty | Confirm folder or try different path |
