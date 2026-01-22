-- UnifiedInbox Database Schema
-- LUKS-encrypted location: /data/.cache/unified-inbox/inbox.sqlite

-- =============================================================================
-- Core Tables
-- =============================================================================

-- Unified items table (all sources)
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,              -- source:unique_id format
    source TEXT NOT NULL,             -- email-ms365, email-gmail, slack, telegram, sdp-ticket, sdp-task
    source_id TEXT NOT NULL,          -- Original ID from source system
    item_type TEXT NOT NULL,          -- message, ticket, task
    timestamp DATETIME NOT NULL,      -- When item was created/sent
    from_name TEXT,                   -- Sender display name
    from_address TEXT,                -- Email, @handle, etc.
    from_user_id TEXT,                -- Source-specific user ID
    subject TEXT,                     -- Subject line or first line preview
    body TEXT,                        -- Full body content (if fetched)
    body_preview TEXT,                -- First 200 chars for display
    thread_id TEXT,                   -- Thread/conversation ID
    thread_context TEXT,              -- JSON array of context messages
    metadata JSON,                    -- Source-specific fields (channel_id, etc.)
    read_status TEXT DEFAULT 'unread', -- unread, read
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_id)
);

-- Triage results (AI or user classifications)
CREATE TABLE IF NOT EXISTS triage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    category TEXT,                    -- Action-Required, FYI, Delegatable, Spam, Archive
    priority TEXT,                    -- P0, P1, P2, P3
    confidence INTEGER,               -- 1-10 confidence score
    quick_win BOOLEAN DEFAULT FALSE,  -- Can be handled in < 5 minutes
    quick_win_reason TEXT,            -- Why it's a quick win
    estimated_time TEXT,              -- 5min, 15min, 30min, 1hr, 2hr+
    reasoning TEXT,                   -- AI reasoning for classification
    suggested_action TEXT,            -- Suggested next action
    triaged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triaged_by TEXT,                  -- 'ai' or 'user'
    UNIQUE(item_id)
);

-- =============================================================================
-- Sync Tracking
-- =============================================================================

-- Sync state per source
CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_sync DATETIME,
    last_successful_sync DATETIME,
    cursor TEXT,                      -- Source-specific checkpoint (delta link, offset, etc.)
    status TEXT,                      -- success, error, in_progress
    error_message TEXT,
    items_synced INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    backoff_until DATETIME            -- For exponential backoff on failures
);

-- Per-item sync progress for checkpoint recovery
CREATE TABLE IF NOT EXISTS sync_progress (
    run_id TEXT,
    item_id TEXT,
    status TEXT,                      -- pending, processing, completed, failed
    error_message TEXT,
    processed_at DATETIME,
    PRIMARY KEY (run_id, item_id)
);

-- =============================================================================
-- Contact Management
-- =============================================================================

-- Unified contacts for VIP detection
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    slack_user_id TEXT,
    telegram_chat_id TEXT,
    is_vip BOOLEAN DEFAULT FALSE,
    vip_reason TEXT,
    organization TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Thread Grouping (Cross-Source Conversations)
-- =============================================================================

-- Thread groups for cross-source conversation linking
CREATE TABLE IF NOT EXISTS thread_groups (
    group_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items belonging to thread groups
CREATE TABLE IF NOT EXISTS thread_members (
    group_id TEXT REFERENCES thread_groups(group_id) ON DELETE CASCADE,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    link_type TEXT,                   -- same_thread, semantic, same_sender_timeframe
    confidence INTEGER,
    PRIMARY KEY (group_id, item_id)
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_timestamp ON items(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_read_status ON items(read_status);
CREATE INDEX IF NOT EXISTS idx_items_source_timestamp ON items(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_items_thread_id ON items(thread_id);

CREATE INDEX IF NOT EXISTS idx_triage_item_id ON triage(item_id);
CREATE INDEX IF NOT EXISTS idx_triage_category ON triage(category);
CREATE INDEX IF NOT EXISTS idx_triage_priority ON triage(priority);
CREATE INDEX IF NOT EXISTS idx_triage_quick_win ON triage(quick_win);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_vip ON contacts(is_vip);

-- =============================================================================
-- Views for Common Queries
-- =============================================================================

-- Unread items with triage status
CREATE VIEW IF NOT EXISTS v_unread_items AS
SELECT
    i.*,
    t.category,
    t.priority,
    t.quick_win,
    t.estimated_time,
    t.triaged_at
FROM items i
LEFT JOIN triage t ON i.id = t.item_id
WHERE i.read_status = 'unread'
ORDER BY i.timestamp DESC;

-- Quick wins (unread, triaged, quick_win=true)
CREATE VIEW IF NOT EXISTS v_quick_wins AS
SELECT
    i.*,
    t.category,
    t.priority,
    t.quick_win_reason,
    t.estimated_time
FROM items i
JOIN triage t ON i.id = t.item_id
WHERE i.read_status = 'unread'
  AND t.quick_win = TRUE
ORDER BY t.priority, i.timestamp;

-- VIP items
CREATE VIEW IF NOT EXISTS v_vip_items AS
SELECT
    i.*,
    c.name AS vip_name,
    c.vip_reason
FROM items i
JOIN contacts c ON (
    i.from_address = c.email
    OR i.from_user_id = c.slack_user_id
    OR json_extract(i.metadata, '$.chatId') = c.telegram_chat_id
)
WHERE c.is_vip = TRUE
ORDER BY i.timestamp DESC;

-- Items by priority (for triage queue)
CREATE VIEW IF NOT EXISTS v_triage_queue AS
SELECT
    i.*,
    t.category,
    t.priority,
    t.quick_win,
    t.reasoning,
    t.suggested_action
FROM items i
JOIN triage t ON i.id = t.item_id
WHERE i.read_status = 'unread'
  AND t.category = 'Action-Required'
ORDER BY
    CASE t.priority
        WHEN 'P0' THEN 0
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        ELSE 4
    END,
    i.timestamp;
