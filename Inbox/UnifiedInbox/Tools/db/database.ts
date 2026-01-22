#!/usr/bin/env bun
/**
 * UnifiedInbox Database Operations
 *
 * SQLite database layer for the unified inbox cache.
 * Location: /data/.cache/unified-inbox/inbox.sqlite
 *
 * @author PAI System
 * @version 1.0.0
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_DB_PATH = "/data/.cache/unified-inbox/inbox.sqlite";
const SCHEMA_PATH = join(dirname(import.meta.path), "schema.sql");

function getDbPath(): string {
  return process.env.UNIFIED_INBOX_DB || DEFAULT_DB_PATH;
}

// =============================================================================
// Database Initialization
// =============================================================================

let _db: Database | null = null;

/**
 * Get or create database connection
 */
export function getDb(): Database {
  if (_db) return _db;

  const dbPath = getDbPath();
  const dbDir = dirname(dbPath);

  // Create directory if it doesn't exist
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Open/create database
  _db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA synchronous = NORMAL");
  _db.run("PRAGMA foreign_keys = ON");

  return _db;
}

/**
 * Initialize database schema
 */
export function initializeSchema(): void {
  const db = getDb();

  // Read and execute schema
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  db.run(schema);
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// =============================================================================
// Item Operations
// =============================================================================

export interface DbItem {
  id: string;
  source: string;
  source_id: string;
  item_type: string;
  timestamp: string;
  from_name: string | null;
  from_address: string | null;
  from_user_id: string | null;
  subject: string | null;
  body: string | null;
  body_preview: string | null;
  thread_id: string | null;
  thread_context: string | null;
  metadata: string | null;
  read_status: string;
  created_at: string;
  updated_at: string;
}

export interface DbTriage {
  id: number;
  item_id: string;
  category: string | null;
  priority: string | null;
  confidence: number | null;
  quick_win: boolean;
  quick_win_reason: string | null;
  estimated_time: string | null;
  reasoning: string | null;
  suggested_action: string | null;
  triaged_at: string;
  triaged_by: string;
}

/**
 * Insert or update an item
 */
export function upsertItem(item: Partial<DbItem>): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO items (
      id, source, source_id, item_type, timestamp,
      from_name, from_address, from_user_id,
      subject, body, body_preview,
      thread_id, thread_context, metadata,
      read_status, created_at, updated_at
    ) VALUES (
      $id, $source, $source_id, $item_type, $timestamp,
      $from_name, $from_address, $from_user_id,
      $subject, $body, $body_preview,
      $thread_id, $thread_context, $metadata,
      $read_status, $created_at, $updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      subject = excluded.subject,
      body = excluded.body,
      body_preview = excluded.body_preview,
      thread_context = excluded.thread_context,
      metadata = excluded.metadata,
      read_status = excluded.read_status,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    $id: item.id,
    $source: item.source,
    $source_id: item.source_id,
    $item_type: item.item_type,
    $timestamp: item.timestamp,
    $from_name: item.from_name || null,
    $from_address: item.from_address || null,
    $from_user_id: item.from_user_id || null,
    $subject: item.subject || null,
    $body: item.body || null,
    $body_preview: item.body_preview || null,
    $thread_id: item.thread_id || null,
    $thread_context: item.thread_context || null,
    $metadata: item.metadata || null,
    $read_status: item.read_status || "unread",
    $created_at: item.created_at || new Date().toISOString(),
    $updated_at: item.updated_at || new Date().toISOString(),
  });
}

/**
 * Get item by ID
 */
export function getItemById(id: string): DbItem | null {
  const db = getDb();
  return db.query<DbItem, [string]>("SELECT * FROM items WHERE id = ?").get(id);
}

/**
 * Query items with filters
 */
export interface QueryOptions {
  source?: string | string[];
  itemType?: string | string[];
  unread?: boolean;
  triaged?: boolean;
  untriaged?: boolean;
  priority?: string | string[];
  category?: string | string[];
  since?: Date;
  before?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "timestamp" | "priority" | "created_at";
  orderDir?: "asc" | "desc";
}

export function queryItems(options: QueryOptions = {}): DbItem[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  // Source filter
  if (options.source) {
    const sources = Array.isArray(options.source) ? options.source : [options.source];
    conditions.push(`source IN (${sources.map((_, i) => `$source${i}`).join(", ")})`);
    sources.forEach((s, i) => (params[`$source${i}`] = s));
  }

  // Item type filter
  if (options.itemType) {
    const types = Array.isArray(options.itemType) ? options.itemType : [options.itemType];
    conditions.push(`item_type IN (${types.map((_, i) => `$type${i}`).join(", ")})`);
    types.forEach((t, i) => (params[`$type${i}`] = t));
  }

  // Read status
  if (options.unread) {
    conditions.push("read_status = 'unread'");
  }

  // Time filters
  if (options.since) {
    conditions.push("timestamp >= $since");
    params.$since = options.since.toISOString();
  }

  if (options.before) {
    conditions.push("timestamp <= $before");
    params.$before = options.before.toISOString();
  }

  // Search
  if (options.search) {
    conditions.push("(subject LIKE $search OR body_preview LIKE $search)");
    params.$search = `%${options.search}%`;
  }

  // Triage filters
  if (options.triaged) {
    conditions.push("id IN (SELECT item_id FROM triage)");
  }
  if (options.untriaged) {
    conditions.push("id NOT IN (SELECT item_id FROM triage)");
  }

  // Build query
  let sql = "SELECT * FROM items";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  // Ordering
  const orderBy = options.orderBy || "timestamp";
  const orderDir = options.orderDir || "desc";
  sql += ` ORDER BY ${orderBy} ${orderDir.toUpperCase()}`;

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  return db.query<DbItem, Record<string, any>>(sql).all(params);
}

/**
 * Mark item as read
 */
export function markItemRead(id: string): boolean {
  const db = getDb();
  const result = db.run(
    "UPDATE items SET read_status = 'read', updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id]
  );
  return result.changes > 0;
}

/**
 * Mark items from source as read
 */
export function markSourceRead(source: string): number {
  const db = getDb();
  const result = db.run(
    "UPDATE items SET read_status = 'read', updated_at = ? WHERE source = ? AND read_status = 'unread'",
    [new Date().toISOString(), source]
  );
  return result.changes;
}

// =============================================================================
// Triage Operations
// =============================================================================

export interface TriageInput {
  itemId: string;
  category?: string;
  priority?: string;
  confidence?: number;
  quickWin?: boolean;
  quickWinReason?: string;
  estimatedTime?: string;
  reasoning?: string;
  suggestedAction?: string;
  triagedBy: "ai" | "user";
}

/**
 * Insert or update triage result
 */
export function upsertTriage(input: TriageInput): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO triage (
      item_id, category, priority, confidence,
      quick_win, quick_win_reason, estimated_time,
      reasoning, suggested_action, triaged_at, triaged_by
    ) VALUES (
      $item_id, $category, $priority, $confidence,
      $quick_win, $quick_win_reason, $estimated_time,
      $reasoning, $suggested_action, $triaged_at, $triaged_by
    )
    ON CONFLICT(item_id) DO UPDATE SET
      category = excluded.category,
      priority = excluded.priority,
      confidence = excluded.confidence,
      quick_win = excluded.quick_win,
      quick_win_reason = excluded.quick_win_reason,
      estimated_time = excluded.estimated_time,
      reasoning = excluded.reasoning,
      suggested_action = excluded.suggested_action,
      triaged_at = excluded.triaged_at,
      triaged_by = excluded.triaged_by
  `);

  stmt.run({
    $item_id: input.itemId,
    $category: input.category || null,
    $priority: input.priority || null,
    $confidence: input.confidence || null,
    $quick_win: input.quickWin ? 1 : 0,
    $quick_win_reason: input.quickWinReason || null,
    $estimated_time: input.estimatedTime || null,
    $reasoning: input.reasoning || null,
    $suggested_action: input.suggestedAction || null,
    $triaged_at: new Date().toISOString(),
    $triaged_by: input.triagedBy,
  });
}

/**
 * Get triage for item
 */
export function getTriageForItem(itemId: string): DbTriage | null {
  const db = getDb();
  return db.query<DbTriage, [string]>("SELECT * FROM triage WHERE item_id = ?").get(itemId);
}

/**
 * Get triage for multiple items
 */
export function getTriageForItems(itemIds: string[]): Map<string, DbTriage> {
  const db = getDb();
  const placeholders = itemIds.map((_, i) => `$id${i}`).join(", ");
  const params: Record<string, string> = {};
  itemIds.forEach((id, i) => (params[`$id${i}`] = id));

  const results = db
    .query<DbTriage, Record<string, string>>(`SELECT * FROM triage WHERE item_id IN (${placeholders})`)
    .all(params);

  return new Map(results.map((t) => [t.item_id, t]));
}

// =============================================================================
// Sync State Operations
// =============================================================================

export interface SyncState {
  source: string;
  last_sync: string | null;
  last_successful_sync: string | null;
  cursor: string | null;
  status: string | null;
  error_message: string | null;
  items_synced: number;
  consecutive_failures: number;
  backoff_until: string | null;
}

/**
 * Get sync state for source
 */
export function getSyncState(source: string): SyncState | null {
  const db = getDb();
  return db.query<SyncState, [string]>("SELECT * FROM sync_state WHERE source = ?").get(source);
}

/**
 * Update sync state
 */
export function updateSyncState(state: Partial<SyncState> & { source: string }): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO sync_state (
      source, last_sync, last_successful_sync, cursor,
      status, error_message, items_synced, consecutive_failures, backoff_until
    ) VALUES (
      $source, $last_sync, $last_successful_sync, $cursor,
      $status, $error_message, $items_synced, $consecutive_failures, $backoff_until
    )
    ON CONFLICT(source) DO UPDATE SET
      last_sync = COALESCE(excluded.last_sync, sync_state.last_sync),
      last_successful_sync = COALESCE(excluded.last_successful_sync, sync_state.last_successful_sync),
      cursor = COALESCE(excluded.cursor, sync_state.cursor),
      status = excluded.status,
      error_message = excluded.error_message,
      items_synced = COALESCE(excluded.items_synced, sync_state.items_synced),
      consecutive_failures = excluded.consecutive_failures,
      backoff_until = excluded.backoff_until
  `);

  stmt.run({
    $source: state.source,
    $last_sync: state.last_sync || null,
    $last_successful_sync: state.last_successful_sync || null,
    $cursor: state.cursor || null,
    $status: state.status || null,
    $error_message: state.error_message || null,
    $items_synced: state.items_synced ?? 0,
    $consecutive_failures: state.consecutive_failures ?? 0,
    $backoff_until: state.backoff_until || null,
  });
}

/**
 * Get all sync states
 */
export function getAllSyncStates(): SyncState[] {
  const db = getDb();
  return db.query<SyncState, []>("SELECT * FROM sync_state").all();
}

// =============================================================================
// Statistics
// =============================================================================

export interface InboxStats {
  total: number;
  unread: number;
  bySource: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  quickWins: number;
  lastSync: Record<string, string | null>;
}

/**
 * Get inbox statistics
 */
export function getStats(source?: string): InboxStats {
  const db = getDb();

  // Total and unread counts
  let totalQuery = "SELECT COUNT(*) as cnt FROM items";
  let unreadQuery = "SELECT COUNT(*) as cnt FROM items WHERE read_status = 'unread'";

  if (source) {
    totalQuery += ` WHERE source = '${source}'`;
    unreadQuery += ` AND source = '${source}'`;
  }

  const total = db.query<{ cnt: number }, []>(totalQuery).get()?.cnt || 0;
  const unread = db.query<{ cnt: number }, []>(unreadQuery).get()?.cnt || 0;

  // By source
  const bySourceRows = db
    .query<{ source: string; cnt: number }, []>(
      source
        ? `SELECT source, COUNT(*) as cnt FROM items WHERE source = '${source}' GROUP BY source`
        : "SELECT source, COUNT(*) as cnt FROM items GROUP BY source"
    )
    .all();
  const bySource: Record<string, number> = {};
  bySourceRows.forEach((r) => (bySource[r.source] = r.cnt));

  // By priority (triaged items only)
  const byPriorityRows = db
    .query<{ priority: string; cnt: number }, []>(
      "SELECT priority, COUNT(*) as cnt FROM triage WHERE priority IS NOT NULL GROUP BY priority"
    )
    .all();
  const byPriority: Record<string, number> = {};
  byPriorityRows.forEach((r) => (byPriority[r.priority] = r.cnt));

  // By category
  const byCategoryRows = db
    .query<{ category: string; cnt: number }, []>(
      "SELECT category, COUNT(*) as cnt FROM triage WHERE category IS NOT NULL GROUP BY category"
    )
    .all();
  const byCategory: Record<string, number> = {};
  byCategoryRows.forEach((r) => (byCategory[r.category] = r.cnt));

  // Quick wins
  const quickWins =
    db
      .query<{ cnt: number }, []>(
        "SELECT COUNT(*) as cnt FROM triage t JOIN items i ON t.item_id = i.id WHERE t.quick_win = 1 AND i.read_status = 'unread'"
      )
      .get()?.cnt || 0;

  // Last sync times
  const lastSyncRows = db
    .query<{ source: string; last_successful_sync: string | null }, []>(
      "SELECT source, last_successful_sync FROM sync_state"
    )
    .all();
  const lastSync: Record<string, string | null> = {};
  lastSyncRows.forEach((r) => (lastSync[r.source] = r.last_successful_sync));

  return {
    total,
    unread,
    bySource,
    byPriority,
    byCategory,
    quickWins,
    lastSync,
  };
}

// =============================================================================
// Contact Operations
// =============================================================================

export interface DbContact {
  id: string;
  name: string | null;
  email: string | null;
  slack_user_id: string | null;
  telegram_chat_id: string | null;
  is_vip: boolean;
  vip_reason: string | null;
  organization: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Check if sender is VIP
 */
export function isVipSender(
  email?: string | null,
  slackUserId?: string | null,
  telegramChatId?: string | null
): DbContact | null {
  const db = getDb();

  if (email) {
    const contact = db
      .query<DbContact, [string]>("SELECT * FROM contacts WHERE email = ? AND is_vip = 1")
      .get(email);
    if (contact) return contact;
  }

  if (slackUserId) {
    const contact = db
      .query<DbContact, [string]>("SELECT * FROM contacts WHERE slack_user_id = ? AND is_vip = 1")
      .get(slackUserId);
    if (contact) return contact;
  }

  if (telegramChatId) {
    const contact = db
      .query<DbContact, [string]>("SELECT * FROM contacts WHERE telegram_chat_id = ? AND is_vip = 1")
      .get(telegramChatId);
    if (contact) return contact;
  }

  return null;
}

/**
 * Add or update contact
 */
export function upsertContact(contact: Partial<DbContact> & { id: string }): void {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO contacts (
      id, name, email, slack_user_id, telegram_chat_id,
      is_vip, vip_reason, organization, notes, created_at
    ) VALUES (
      $id, $name, $email, $slack_user_id, $telegram_chat_id,
      $is_vip, $vip_reason, $organization, $notes, $created_at
    )
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      email = COALESCE(excluded.email, contacts.email),
      slack_user_id = COALESCE(excluded.slack_user_id, contacts.slack_user_id),
      telegram_chat_id = COALESCE(excluded.telegram_chat_id, contacts.telegram_chat_id),
      is_vip = excluded.is_vip,
      vip_reason = COALESCE(excluded.vip_reason, contacts.vip_reason),
      organization = COALESCE(excluded.organization, contacts.organization),
      notes = COALESCE(excluded.notes, contacts.notes)
  `);

  stmt.run({
    $id: contact.id,
    $name: contact.name || null,
    $email: contact.email || null,
    $slack_user_id: contact.slack_user_id || null,
    $telegram_chat_id: contact.telegram_chat_id || null,
    $is_vip: contact.is_vip ? 1 : 0,
    $vip_reason: contact.vip_reason || null,
    $organization: contact.organization || null,
    $notes: contact.notes || null,
    $created_at: contact.created_at || new Date().toISOString(),
  });
}

// =============================================================================
// CLI for Testing
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      initializeSchema();
      console.log(`Database initialized at ${getDbPath()}`);
      break;

    case "stats":
      initializeSchema();
      const stats = getStats();
      console.log(JSON.stringify(stats, null, 2));
      break;

    case "path":
      console.log(getDbPath());
      break;

    default:
      console.log(`
Database CLI

Usage:
  bun database.ts init    Initialize database schema
  bun database.ts stats   Show statistics
  bun database.ts path    Show database path
`);
  }

  closeDb();
}

if (import.meta.main) {
  main().catch(console.error);
}
