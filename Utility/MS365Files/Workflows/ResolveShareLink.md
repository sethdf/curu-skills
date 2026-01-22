# Resolve Share Link Workflow

Resolve a SharePoint or OneDrive sharing URL directly to file metadata without searching.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Resolving shared file link"}' \
  > /dev/null 2>&1 &
```

## When to Use

Use this workflow when:
- User pastes a SharePoint/OneDrive sharing link from Slack, Teams, email, etc.
- URL contains `/s/` (SharePoint) or `/p/` (OneDrive personal)
- URL has a sharing token like `IQBxyz...` or `EQabc...`

This is the **most efficient** method - no search required, instant metadata retrieval.

## Step 1: Identify URL Type

SharePoint/OneDrive sharing URLs follow these patterns:

| Pattern | Type | Example |
|---------|------|---------|
| `/:x:/s/` | SharePoint Excel | `https://buxtonco.sharepoint.com/:x:/s/Buxton-IT/IQBpPe...` |
| `/:w:/s/` | SharePoint Word | `https://buxtonco.sharepoint.com/:w:/s/SiteName/EQabc...` |
| `/:p:/s/` | SharePoint PowerPoint | `https://buxtonco.sharepoint.com/:p:/s/SiteName/...` |
| `/:b:/s/` | SharePoint PDF | `https://buxtonco.sharepoint.com/:b:/s/SiteName/...` |
| `/:f:/s/` | SharePoint Folder | `https://buxtonco.sharepoint.com/:f:/s/SiteName/...` |
| `/:x:/p/` | OneDrive Excel | `https://buxtonco-my.sharepoint.com/:x:/p/username/...` |

The letter after `/:` indicates file type:
- `x` = Excel
- `w` = Word
- `p` = PowerPoint
- `b` = PDF/Binary
- `f` = Folder
- `o` = OneNote

## Step 2: Encode the Sharing URL

The Graph API `shares` endpoint requires the URL to be base64 encoded with a `u!` prefix.

**Critical**: The `!` character must be URL-encoded as `%21` to avoid PowerShell/Graph issues.

```powershell
# Extract base URL (remove query params for cleaner encoding, though full URL works too)
$shareUrl = 'https://buxtonco.sharepoint.com/:x:/s/Buxton-IT/IQBpPe9HtWTJR5bJPSGvY2NSAeZv-zKxSW5JKlkSXsbOtIY'

# Base64 encode with URL-safe characters
$base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($shareUrl))
$encoded = 'u%21' + $base64.TrimEnd('=').Replace('/','_').Replace('+','-')
```

## Step 3: Resolve via Graph API

```bash
auth-keeper ms365 '
$shareUrl = "<PASTE_SHARE_URL_HERE>"
$base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($shareUrl))
$encoded = "u%21" + $base64.TrimEnd("=").Replace("/","_").Replace("+","-")
$result = Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/shares/$encoded/driveItem"
$result | ConvertTo-Json -Depth 3
'
```

## Step 4: Extract Key Information

The response contains everything needed for further operations:

```json
{
  "name": "Master Vendor List.xlsx",
  "id": "01VT5DMITJHXXUPNLEZFDZNSJ5EGXWGY2S",        // Item ID for download
  "size": 80598,
  "lastModifiedDateTime": "2026-01-08T21:39:03Z",
  "lastModifiedBy": { "user": { "displayName": "Jenny LaCroix" }},
  "parentReference": {
    "driveId": "b!hOy6YIWpjE2...",                   // Drive ID for operations
    "siteId": "60baec84-a985-4d8c...",              // Site ID
    "path": "/drives/.../root:/Vendor Related"      // Full path
  },
  "@microsoft.graph.downloadUrl": "https://..."     // Direct download (time-limited)
}
```

## Step 5: Present Results and Offer Actions

Format output:

```
Resolved shared file:

| Property      | Value                                |
|---------------|--------------------------------------|
| Name          | Master Vendor List.xlsx              |
| Location      | Buxton-IT / Vendor Related           |
| Size          | 80.6 KB                              |
| Last Modified | 2026-01-08 by Jenny LaCroix          |
| Item ID       | 01VT5DMITJHXXUPNLEZFDZNSJ5EGXWGY2S   |

Would you like me to download this file?
```

## Direct Download Option

The response includes `@microsoft.graph.downloadUrl` - a pre-authenticated URL valid for ~1 hour. For immediate download:

```bash
# Using the download URL from the response
curl -L "<download_url>" -o ~/WORK/scratch/filename.xlsx
```

Or use the Download workflow with the extracted Item ID and Drive ID.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `BadRequest` | URL encoding issue | Ensure `!` is encoded as `%21` |
| `AccessDenied` | No permission to file | Request access from file owner |
| `ItemNotFound` | Link expired or file deleted | Ask for updated link |
| `InvalidSharingLink` | Malformed URL | Verify URL is complete |

## Complete Example

```bash
# Resolve a Slack-shared SharePoint link
auth-keeper ms365 '
$shareUrl = "https://buxtonco.sharepoint.com/:x:/s/Buxton-IT/IQBpPe9HtWTJR5bJPSGvY2NSAeZv-zKxSW5JKlkSXsbOtIY"
$base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($shareUrl))
$encoded = "u%21" + $base64.TrimEnd("=").Replace("/","_").Replace("+","-")
$item = Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/shares/$encoded/driveItem"
Write-Host "File: $($item.name)"
Write-Host "Size: $([math]::Round($item.size/1024, 1)) KB"
Write-Host "Modified: $($item.lastModifiedDateTime) by $($item.lastModifiedBy.user.displayName)"
Write-Host "Item ID: $($item.id)"
Write-Host "Drive ID: $($item.parentReference.driveId)"
'
```
