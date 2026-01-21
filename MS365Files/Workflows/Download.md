# Download Workflow

Download a file from OneDrive or SharePoint to local storage.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Downloading file from cloud storage"}' \
  > /dev/null 2>&1 &
```

## Prerequisites

Before downloading, you need:
1. **Item ID**: The file's unique identifier (from Search or List workflow)
2. **Source**: OneDrive or SharePoint (and site/drive IDs if SharePoint)
3. **File name**: For naming the local file

If these aren't known, run Search workflow first.

## Step 1: Determine Download Location

Default: `~/WORK/scratch/`

If user specifies a location, use that instead. Ensure directory exists:
```bash
mkdir -p ~/WORK/scratch/
```

## Step 2: Download File

### From OneDrive

```bash
auth-keeper ms365 "Get-MgUserDriveItemContent -UserId 'sfoley@buxtonco.com' -DriveItemId '<item-id>' -OutFile '$HOME/WORK/scratch/<filename>'"
```

### From SharePoint

```bash
auth-keeper ms365 "Get-MgSiteDriveItemContent -SiteId '<site-id>' -DriveId '<drive-id>' -DriveItemId '<item-id>' -OutFile '$HOME/WORK/scratch/<filename>'"
```

### Using CLI Tool (Recommended)

The CLI tool handles both OneDrive and SharePoint with consistent interface:

```bash
bun ~/.claude/skills/MS365Files/Tools/Download.ts \
  --item-id "<item-id>" \
  --filename "<filename>" \
  --output ~/WORK/scratch/ \
  [--site-id "<site-id>"] \
  [--drive-id "<drive-id>"]
```

## Step 3: Verify Download

Check file exists and has content:
```bash
ls -la ~/WORK/scratch/<filename>
```

## Step 4: Report Success

Tell user:
- Full path to downloaded file
- File size
- Offer to open the file or containing folder

Example:
```
Downloaded: Q4_Report.xlsx
Location: ~/WORK/scratch/Q4_Report.xlsx
Size: 2.4 MB

Would you like me to open the file or the folder?
```

## Intent-to-Flag Mapping (for CLI Tool)

| User Says | Flag | Effect |
|-----------|------|--------|
| "download to Downloads" | `--output ~/Downloads/` | Save to Downloads folder |
| "put it in current folder" | `--output ./` | Save to current directory |
| "save as report.xlsx" | `--filename report.xlsx` | Custom filename |
| (default) | `--output ~/WORK/scratch/` | Default scratch location |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Item not found` | Invalid item ID | Run Search workflow to get correct ID |
| `Access denied` | No permission to file | Request access from file owner |
| `Path not found` | Invalid output directory | Create directory with `mkdir -p` |
| `File already exists` | Name collision | Append timestamp or ask user for new name |

## Batch Downloads

For multiple files, loop through item IDs:
```bash
for id in "abc123" "def456" "ghi789"; do
  bun ~/.claude/skills/MS365Files/Tools/Download.ts --item-id "$id" --output ~/WORK/scratch/
done
```
