# Sync Workflow

Sync items from message sources to the unified inbox cache.

## Quick Usage

```bash
# Sync all sources
inbox sync

# Sync specific source
inbox sync --source email-ms365

# Sync multiple sources
inbox sync --source slack,telegram

# Only sync recent items
inbox sync --since "1 day ago"

# Preview what would sync
inbox sync --dry-run
```

## How It Works

1. For each source, check if we're in backoff (previous failures)
2. Call the source adapter's `getItems()` method
3. Normalize items to the unified format
4. Upsert items into the SQLite cache
5. Update sync state (cursor, timestamp, status)

## Sync State

Each source tracks:
- `last_sync` - When sync was last attempted
- `last_successful_sync` - When sync last succeeded
- `cursor` - Source-specific checkpoint for incremental sync
- `status` - success, error, or in_progress
- `consecutive_failures` - For exponential backoff

## Error Handling

Failed syncs use exponential backoff:
- 1st failure: retry after 1 minute
- 2nd failure: retry after 2 minutes
- 3rd failure: retry after 4 minutes
- Max: 30 minutes

Check sync status with `inbox stats`.

## Cron Setup

For automated syncing, see `CronSetup.md` workflow.
