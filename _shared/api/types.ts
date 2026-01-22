/**
 * Shared Types for UnifiedInbox API Layer
 *
 * These interfaces are used by all source adapters (ms365, gmail, slack, telegram, sdp)
 * to normalize data into a consistent format for the UnifiedInbox cache.
 */

// =============================================================================
// Core Item Types
// =============================================================================

/**
 * Normalized item from any source (email, chat, ticket, task)
 */
export interface Item {
  /** Unique ID in format "source:source_id" */
  id: string;
  /** Source system: email-ms365, email-gmail, slack, telegram, sdp-ticket, sdp-task */
  source: ItemSource;
  /** Original ID from the source system */
  sourceId: string;
  /** Type of item */
  itemType: ItemType;
  /** When the item was created/sent */
  timestamp: Date;
  /** Sender information */
  from: Sender;
  /** Subject line (for emails/tickets) or first line preview (for chat) */
  subject: string | null;
  /** Full body content */
  body: string | null;
  /** Preview of body (first 200 chars) */
  bodyPreview: string | null;
  /** Thread/conversation ID if applicable */
  threadId: string | null;
  /** Previous messages in thread for context */
  threadContext: ContextMessage[] | null;
  /** Source-specific metadata (channel_id, ticket_status, etc.) */
  metadata: Record<string, unknown>;
  /** Read/unread status */
  readStatus: ReadStatus;
  /** When synced to cache */
  createdAt: Date;
  /** Last updated in cache */
  updatedAt: Date;
}

export type ItemSource =
  | 'email-ms365'
  | 'email-gmail'
  | 'slack'
  | 'telegram'
  | 'sdp-ticket'
  | 'sdp-task';

export type ItemType = 'message' | 'ticket' | 'task';

export type ReadStatus = 'unread' | 'read';

/**
 * Sender information normalized across sources
 */
export interface Sender {
  name: string | null;
  address: string | null;  // email address, slack handle, telegram username
  userId: string | null;   // source-specific user ID for cross-source matching
}

/**
 * Context message from thread history
 */
export interface ContextMessage {
  timestamp: Date;
  from: Sender;
  body: string;
}

// =============================================================================
// Triage Types
// =============================================================================

/**
 * AI-generated triage result for an item
 */
export interface TriageResult {
  itemId: string;
  category: TriageCategory;
  priority: Priority;
  confidence: number;  // 1-10
  quickWin: boolean;
  quickWinReason: string | null;
  estimatedTime: EstimatedTime | null;
  reasoning: string;
  suggestedAction: string | null;
  triagedAt: Date;
  triagedBy: 'ai' | 'user';
}

export type TriageCategory =
  | 'Action-Required'
  | 'FYI'
  | 'Delegatable'
  | 'Spam'
  | 'Archive';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type EstimatedTime = '5min' | '15min' | '30min' | '1hr' | '2hr+';

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Options for sync operations
 */
export interface SyncOptions {
  /** Maximum items to sync */
  limit?: number;
  /** Only sync items since this date */
  since?: Date;
  /** Resume from this cursor/checkpoint */
  cursor?: string;
  /** Don't write to database, just show what would sync */
  dryRun?: boolean;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether sync completed without fatal errors */
  success: boolean;
  /** Number of items processed */
  itemsProcessed: number;
  /** Number of items skipped (duplicates, filtered) */
  itemsSkipped: number;
  /** Number of items deleted (delta sync) */
  itemsDeleted: number;
  /** Errors encountered */
  errors: SyncError[];
  /** Cursor for next sync (for delta/incremental sync) */
  cursor: string | null;
  /** Duration in milliseconds */
  duration: number;
  /** Recommended time for next sync */
  nextSyncRecommended: Date | null;
}

/**
 * Error during sync
 */
export interface SyncError {
  /** Item ID if error was for specific item */
  itemId?: string;
  /** Error message */
  message: string;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Original error for logging */
  originalError?: unknown;
}

/**
 * Sync state tracking per source
 */
export interface SyncState {
  source: ItemSource;
  lastSync: Date | null;
  lastSuccessfulSync: Date | null;
  cursor: string | null;
  status: 'success' | 'error' | 'in_progress';
  errorMessage: string | null;
  itemsSynced: number;
  consecutiveFailures: number;
  backoffUntil: Date | null;
}

// =============================================================================
// Source Adapter Interface
// =============================================================================

/**
 * Interface that all source adapters must implement
 */
export interface SourceAdapter {
  /** Name of the adapter */
  name: ItemSource;

  /** Rate limit between API calls in ms (optional) */
  rateLimitMs?: number;

  /**
   * Sync items from source to cache
   */
  sync(options?: SyncOptions): Promise<SyncResult>;

  /**
   * Get items from source (without caching)
   */
  getItems(since?: Date): Promise<Item[]>;

  /**
   * Check if the source is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get thread context for an item (optional)
   */
  getThreadContext?(itemId: string): Promise<ContextMessage[]>;
}

// =============================================================================
// Contact Types (for VIP detection)
// =============================================================================

/**
 * Unified contact across sources
 */
export interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  slackUserId: string | null;
  telegramChatId: string | null;
  isVip: boolean;
  vipReason: string | null;
  organization: string | null;
  notes: string | null;
  createdAt: Date;
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Options for querying cached items
 */
export interface QueryOptions {
  /** Filter by source */
  source?: ItemSource | ItemSource[];
  /** Filter by item type */
  itemType?: ItemType | ItemType[];
  /** Only unread items */
  unread?: boolean;
  /** Only triaged items */
  triaged?: boolean;
  /** Only untriaged items */
  untriaged?: boolean;
  /** Filter by priority */
  priority?: Priority | Priority[];
  /** Filter by category */
  category?: TriageCategory | TriageCategory[];
  /** Items since this date */
  since?: Date;
  /** Items before this date */
  before?: Date;
  /** Search in subject/body */
  search?: string;
  /** Maximum items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order */
  orderBy?: 'timestamp' | 'priority' | 'created_at';
  /** Sort direction */
  orderDir?: 'asc' | 'desc';
}

/**
 * Result of a query operation
 */
export interface QueryResult {
  items: Item[];
  triage: Map<string, TriageResult>;  // itemId -> triage
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Statistics for inbox items
 */
export interface InboxStats {
  /** Total items in cache */
  total: number;
  /** Unread items */
  unread: number;
  /** Items by source */
  bySource: Record<ItemSource, number>;
  /** Items by priority (triaged only) */
  byPriority: Record<Priority, number>;
  /** Items by category (triaged only) */
  byCategory: Record<TriageCategory, number>;
  /** Quick wins available */
  quickWins: number;
  /** Last sync times per source */
  lastSync: Record<ItemSource, Date | null>;
}
