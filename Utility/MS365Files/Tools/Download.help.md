# Download.ts

Download files from OneDrive or SharePoint to local storage.

## Usage

```bash
bun ~/.claude/skills/MS365Files/Tools/Download.ts --item-id <id> [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--item-id <id>` | **Required.** The file's unique ID from MS365 | - |
| `--filename <name>` | Local filename for the downloaded file | Auto-detected from MS365 |
| `--output <dir>` | Output directory | `~/WORK/scratch/` |
| `--site-id <id>` | SharePoint site ID (for SharePoint files) | - |
| `--drive-id <id>` | Drive ID (required when using `--site-id`) | - |
| `--overwrite` | Overwrite existing file | `false` |
| `--help` | Show help message | - |

## Examples

### Download from OneDrive

```bash
# Basic download
bun Download.ts --item-id "01ABC123DEF456"

# Download to specific folder
bun Download.ts --item-id "01ABC123DEF456" --output ~/Downloads/

# Download with custom filename
bun Download.ts --item-id "01ABC123DEF456" --filename "budget_2024.xlsx"
```

### Download from SharePoint

```bash
# SharePoint requires site-id and drive-id
bun Download.ts \
  --item-id "01XYZ789" \
  --site-id "buxtonco.sharepoint.com,abc-def-123" \
  --drive-id "b!xyz456"
```

### Find Item IDs

Use the Search or List workflows to find item IDs:

```bash
# Search OneDrive
auth-keeper ms365 "Search-MgUserDriveRoot -UserId 'sfoley@buxtonco.com' -Q 'budget' | Select-Object Name, Id"

# List folder contents
auth-keeper ms365 "Get-MgUserDriveRootChildren -UserId 'sfoley@buxtonco.com' | Select-Object Name, Id"
```

## How It Works

1. Fetches file metadata from MS365 Graph API
2. Creates output directory if needed
3. Downloads file content using Graph PowerShell
4. Reports success with file path and size

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `--item-id is required` | Missing item ID | Provide item ID from Search/List |
| `--drive-id is required` | SharePoint without drive | Add `--drive-id` flag |
| `File already exists` | Name collision | Use `--overwrite` or `--filename` |
| `Could not get file information` | Invalid item ID | Verify ID with Search workflow |

## Related

- `Workflows/Search.md` - Find files and get their IDs
- `Workflows/List.md` - Browse folders and get IDs
- `Workflows/Sites.md` - Find SharePoint site/drive IDs
