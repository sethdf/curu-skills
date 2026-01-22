# UnifiedInbox Database Schema

SQLite database for the unified inbox cache.

**Location:** `/data/.cache/unified-inbox/inbox.sqlite`

## Tables

### items

Normalized items from all sources.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `source:source_id` format |
| source | TEXT | email-ms365, email-gmail, slack, telegram, sdp-ticket, sdp-task |
| source_id | TEXT | Original ID from source system |
| item_type | TEXT | message, ticket, task |
| timestamp | DATETIME | When item was created/sent |
| from_name | TEXT | Sender display name |
| from_address | TEXT | Email, @handle, etc. |
| from_user_id | TEXT | Source-specific user ID |
| subject | TEXT | Subject line or first line preview |
| body | TEXT | Full body content |
| body_preview | TEXT | First 200 chars |
| thread_id | TEXT | Thread/conversation ID |
| thread_context | TEXT | JSON array of context messages |
| metadata | JSON | Source-specific fields |
| read_status | TEXT | unread, read |
| created_at | DATETIME | When synced to cache |
| updated_at | DATETIME | Last updated |

### triage

AI or user triage results.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| item_id | TEXT FK | References items(id) |
| category | TEXT | Action-Required, FYI, Delegatable, Spam, Archive |
| priority | TEXT | P0, P1, P2, P3 |
| confidence | INTEGER | 1-10 confidence score |
| quick_win | BOOLEAN | Can be handled in < 5 minutes |
| quick_win_reason | TEXT | Why it's a quick win |
| estimated_time | TEXT | 5min, 15min, 30min, 1hr, 2hr+ |
| reasoning | TEXT | AI reasoning for classification |
| suggested_action | TEXT | Suggested next action |
| triaged_at | DATETIME | When triaged |
| triaged_by | TEXT | 'ai' or 'user' |

### sync_state

Per-source sync tracking.

| Column | Type | Description |
|--------|------|-------------|
| source | TEXT PK | Source name |
| last_sync | DATETIME | When sync was last attempted |
| last_successful_sync | DATETIME | When sync last succeeded |
| cursor | TEXT | Source-specific checkpoint |
| status | TEXT | success, error, in_progress |
| error_message | TEXT | Last error message |
| items_synced | INTEGER | Items synced in last successful run |
| consecutive_failures | INTEGER | For exponential backoff |
| backoff_until | DATETIME | When to retry after failure |

### contacts

Unified contacts for VIP detection.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Contact ID |
| name | TEXT | Display name |
| email | TEXT | Email address |
| slack_user_id | TEXT | Slack user ID |
| telegram_chat_id | TEXT | Telegram chat ID |
| is_vip | BOOLEAN | VIP flag |
| vip_reason | TEXT | Why they're VIP |
| organization | TEXT | Company/org |
| notes | TEXT | Additional notes |
| created_at | DATETIME | When created |

## Views

### v_unread_items

Unread items with triage status joined.

### v_quick_wins

Unread, triaged items marked as quick wins.

### v_vip_items

Items from VIP contacts.

### v_triage_queue

Action-Required items sorted by priority.

## Indexes

- `idx_items_source` - Fast source filtering
- `idx_items_timestamp` - Fast time-based queries
- `idx_items_read_status` - Fast unread filtering
- `idx_items_source_timestamp` - Combined source + time
- `idx_items_thread_id` - Thread lookups
- `idx_triage_item_id` - Triage lookups
- `idx_triage_category` - Category filtering
- `idx_triage_priority` - Priority filtering
- `idx_triage_quick_win` - Quick win filtering
- `idx_contacts_email` - Email lookups
- `idx_contacts_is_vip` - VIP filtering

## Example Queries

```sql
-- Get unread items with triage
SELECT i.*, t.category, t.priority
FROM items i
LEFT JOIN triage t ON i.id = t.item_id
WHERE i.read_status = 'unread'
ORDER BY i.timestamp DESC
LIMIT 50;

-- Get quick wins
SELECT i.subject, i.from_name, t.quick_win_reason
FROM items i
JOIN triage t ON i.id = t.item_id
WHERE i.read_status = 'unread' AND t.quick_win = 1;

-- Get items from VIP
SELECT i.*
FROM items i
JOIN contacts c ON i.from_address = c.email
WHERE c.is_vip = 1;

-- Count by source and status
SELECT source, read_status, COUNT(*) as cnt
FROM items
GROUP BY source, read_status;
```
