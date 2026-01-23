#!/usr/bin/env bun
/**
 * UnifiedInbox CLI - Main Entry Point
 *
 * Unified inbox operations for all message sources.
 * Layer 2 (deterministic) of the PAI inbox infrastructure.
 *
 * Usage:
 *   inbox sync [--source X]              Sync items from sources
 *   inbox query [--unread] [--source X]  Query cached items
 *   inbox stats [--source X]             Show statistics
 *   inbox mark-read <item-id>            Mark item as read
 *   inbox triage <item-id> [options]     Set triage results
 *
 * @author PAI System
 * @version 1.0.0
 */

import {
  initializeSchema,
  closeDb,
  upsertItem,
  queryItems,
  markItemRead,
  markSourceRead,
  upsertTriage,
  getStats,
  getSyncState,
  updateSyncState,
  getAllSyncStates,
  type QueryOptions,
  type TriageInput,
} from "./db/database";

// Import source adapters
import { ms365Adapter, normalizeEmail as normalizeMs365Email, getUnreadEmails as getMs365Emails } from "../../../_shared/api/ms365";
import { gmailAdapter, normalizeEmail as normalizeGmailEmail, getUnreadEmails as getGmailEmails } from "../../../_shared/api/gmail";
import { slackAdapter, normalizeMessage as normalizeSlackMessage, getRecentMessages as getSlackMessages } from "../../../_shared/api/slack";
import { telegramAdapter, normalizeUpdate, getUpdates as getTelegramUpdates } from "../../../_shared/api/telegram";
import { sdpTicketAdapter, sdpTaskAdapter, normalizeTicket, normalizeTask, getOpenTickets, getMyTasks } from "../../../_shared/api/sdp";

import type { Item, SourceAdapter, ItemSource } from "../../../_shared/api/types";

// =============================================================================
// Source Registry
// =============================================================================

const ADAPTERS: Record<string, SourceAdapter> = {
  "email-ms365": ms365Adapter,
  "email-gmail": gmailAdapter,
  "slack": slackAdapter,
  "telegram": telegramAdapter,
  "sdp-ticket": sdpTicketAdapter,
  "sdp-task": sdpTaskAdapter,
};

const ALL_SOURCES: ItemSource[] = [
  "email-ms365",
  "email-gmail",
  "slack",
  "telegram",
  "sdp-ticket",
  "sdp-task",
];

// =============================================================================
// Sync Command
// =============================================================================

interface SyncOptions {
  source?: string;
  since?: string;
  dryRun?: boolean;
  quiet?: boolean;
}

async function syncCommand(options: SyncOptions): Promise<void> {
  initializeSchema();

  const sources = options.source
    ? options.source.split(",").map((s) => s.trim())
    : ALL_SOURCES;

  if (!options.quiet) {
    console.log(`Syncing sources: ${sources.join(", ")}`);
  }

  for (const source of sources) {
    const adapter = ADAPTERS[source];
    if (!adapter) {
      console.error(`Unknown source: ${source}`);
      continue;
    }

    // Check if we should skip due to backoff
    const state = getSyncState(source);
    if (state?.backoff_until) {
      const backoffUntil = new Date(state.backoff_until);
      if (backoffUntil > new Date()) {
        if (!options.quiet) {
          console.log(`Skipping ${source} (backoff until ${state.backoff_until})`);
        }
        continue;
      }
    }

    // Update sync state to in_progress
    updateSyncState({
      source,
      status: "in_progress",
      last_sync: new Date().toISOString(),
    });

    try {
      if (!options.quiet) {
        console.log(`\nSyncing ${source}...`);
      }

      // Get items from source
      const sinceDate = options.since ? parseTimeAgo(options.since) : undefined;
      const items = await adapter.getItems(sinceDate);

      if (!options.quiet) {
        console.log(`  Found ${items.length} items`);
      }

      if (!options.dryRun) {
        // Store items in database
        for (const item of items) {
          // Skip items with missing required fields
          if (!item.sourceId) {
            console.error(`  Skipping item with missing sourceId: ${item.subject?.substring(0, 30)}`);
            continue;
          }
          upsertItem({
            id: item.id,
            source: item.source,
            source_id: item.sourceId,
            item_type: item.itemType,
            timestamp: (item.timestamp && !isNaN(item.timestamp.getTime()))
              ? item.timestamp.toISOString()
              : new Date().toISOString(),
            from_name: item.from?.name || null,
            from_address: item.from?.address || null,
            from_user_id: item.from?.userId || null,
            subject: item.subject,
            body: item.body,
            body_preview: item.bodyPreview,
            thread_id: item.threadId,
            thread_context: item.threadContext ? JSON.stringify(item.threadContext) : null,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            read_status: item.readStatus,
          });
        }
      }

      // Update sync state to success
      updateSyncState({
        source,
        status: "success",
        last_successful_sync: new Date().toISOString(),
        items_synced: items.length,
        consecutive_failures: 0,
        error_message: null,
        backoff_until: null,
      });

      if (!options.quiet) {
        console.log(`  Synced ${items.length} items`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);

      // Get current failure count
      const currentState = getSyncState(source);
      const failures = (currentState?.consecutive_failures || 0) + 1;

      // Calculate backoff (exponential: 1min, 2min, 4min, 8min, max 30min)
      const backoffMinutes = Math.min(Math.pow(2, failures - 1), 30);
      const backoffUntil = new Date(Date.now() + backoffMinutes * 60 * 1000);

      updateSyncState({
        source,
        status: "error",
        error_message: errorMsg,
        consecutive_failures: failures,
        backoff_until: backoffUntil.toISOString(),
      });

      console.error(`  Error syncing ${source}: ${errorMsg}`);
      console.error(`  Will retry after ${backoffMinutes} minute(s)`);
    }
  }

  closeDb();
}

// =============================================================================
// Query Command
// =============================================================================

interface QueryCmdOptions {
  source?: string;
  unread?: boolean;
  triaged?: boolean;
  untriaged?: boolean;
  priority?: string;
  category?: string;
  since?: string;
  limit?: number;
  json?: boolean;
}

async function queryCommand(options: QueryCmdOptions): Promise<void> {
  initializeSchema();

  const queryOpts: QueryOptions = {
    limit: options.limit || 50,
  };

  if (options.source) {
    queryOpts.source = options.source.split(",").map((s) => s.trim());
  }

  if (options.unread) {
    queryOpts.unread = true;
  }

  if (options.triaged) {
    queryOpts.triaged = true;
  }

  if (options.untriaged) {
    queryOpts.untriaged = true;
  }

  if (options.priority) {
    queryOpts.priority = options.priority.split(",").map((p) => p.trim());
  }

  if (options.category) {
    queryOpts.category = options.category.split(",").map((c) => c.trim());
  }

  if (options.since) {
    queryOpts.since = parseTimeAgo(options.since);
  }

  const items = queryItems(queryOpts);

  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
  } else {
    console.log(`Found ${items.length} items:\n`);

    for (const item of items) {
      const timestamp = new Date(item.timestamp).toLocaleString();
      const status = item.read_status === "unread" ? "[UNREAD]" : "[read]";
      const from = item.from_name || item.from_address || "Unknown";

      console.log(`${status} ${item.source} | ${timestamp}`);
      console.log(`  From: ${from}`);
      console.log(`  Subject: ${item.subject || "(no subject)"}`);
      if (item.body_preview) {
        console.log(`  Preview: ${item.body_preview.substring(0, 80)}...`);
      }
      console.log(`  ID: ${item.id}`);
      console.log();
    }
  }

  closeDb();
}

// =============================================================================
// Stats Command
// =============================================================================

interface StatsCmdOptions {
  source?: string;
  json?: boolean;
}

async function statsCommand(options: StatsCmdOptions): Promise<void> {
  initializeSchema();

  const stats = getStats(options.source);
  const syncStates = getAllSyncStates();

  if (options.json) {
    console.log(JSON.stringify({ stats, syncStates }, null, 2));
  } else {
    console.log("=== Inbox Statistics ===\n");
    console.log(`Total items: ${stats.total}`);
    console.log(`Unread: ${stats.unread}`);
    console.log(`Quick wins: ${stats.quickWins}\n`);

    console.log("By Source:");
    for (const [source, count] of Object.entries(stats.bySource)) {
      const lastSync = stats.lastSync[source];
      const syncInfo = lastSync ? ` (last sync: ${new Date(lastSync).toLocaleString()})` : " (never synced)";
      console.log(`  ${source}: ${count}${syncInfo}`);
    }

    if (Object.keys(stats.byPriority).length > 0) {
      console.log("\nBy Priority (triaged):");
      for (const [priority, count] of Object.entries(stats.byPriority)) {
        console.log(`  ${priority}: ${count}`);
      }
    }

    if (Object.keys(stats.byCategory).length > 0) {
      console.log("\nBy Category (triaged):");
      for (const [category, count] of Object.entries(stats.byCategory)) {
        console.log(`  ${category}: ${count}`);
      }
    }

    console.log("\nSync Status:");
    for (const state of syncStates) {
      const status = state.status === "success" ? "OK" : state.status === "error" ? "ERROR" : state.status;
      console.log(`  ${state.source}: ${status}`);
      if (state.error_message) {
        console.log(`    Error: ${state.error_message}`);
      }
      if (state.backoff_until && new Date(state.backoff_until) > new Date()) {
        console.log(`    Backoff until: ${state.backoff_until}`);
      }
    }
  }

  closeDb();
}

// =============================================================================
// Mark-Read Command
// =============================================================================

interface MarkReadOptions {
  source?: string;
}

async function markReadCommand(itemId: string | undefined, options: MarkReadOptions): Promise<void> {
  initializeSchema();

  if (options.source) {
    const count = markSourceRead(options.source);
    console.log(`Marked ${count} items from ${options.source} as read`);
  } else if (itemId) {
    const success = markItemRead(itemId);
    if (success) {
      console.log(`Marked ${itemId} as read`);
    } else {
      console.error(`Item not found: ${itemId}`);
      process.exit(1);
    }
  } else {
    console.error("Usage: inbox mark-read <item-id> OR inbox mark-read --source <source>");
    process.exit(1);
  }

  closeDb();
}

// =============================================================================
// Triage Command
// =============================================================================

interface TriageCmdOptions {
  priority?: string;
  category?: string;
  confidence?: number;
  quickWin?: boolean;
  quickWinReason?: string;
  estimatedTime?: string;
  reasoning?: string;
  suggestedAction?: string;
}

async function triageCommand(itemId: string, options: TriageCmdOptions): Promise<void> {
  initializeSchema();

  const input: TriageInput = {
    itemId,
    triagedBy: "user",
  };

  if (options.priority) input.priority = options.priority;
  if (options.category) input.category = options.category;
  if (options.confidence) input.confidence = options.confidence;
  if (options.quickWin) input.quickWin = options.quickWin;
  if (options.quickWinReason) input.quickWinReason = options.quickWinReason;
  if (options.estimatedTime) input.estimatedTime = options.estimatedTime;
  if (options.reasoning) input.reasoning = options.reasoning;
  if (options.suggestedAction) input.suggestedAction = options.suggestedAction;

  upsertTriage(input);
  console.log(`Triage saved for ${itemId}`);

  closeDb();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse relative time strings like "1 day ago", "2 hours ago"
 */
function parseTimeAgo(timeStr: string): Date {
  const now = new Date();
  const match = timeStr.match(/(\d+)\s*(minute|hour|day|week)s?\s*ago/i);

  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "minute":
        return new Date(now.getTime() - amount * 60 * 1000);
      case "hour":
        return new Date(now.getTime() - amount * 60 * 60 * 1000);
      case "day":
        return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
      case "week":
        return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Try parsing as ISO date
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Cannot parse time: ${timeStr}`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string | boolean> } {
  const command = args[0] || "help";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

// =============================================================================
// Main CLI
// =============================================================================

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "sync":
      await syncCommand({
        source: flags.source as string,
        since: flags.since as string,
        dryRun: !!flags["dry-run"],
        quiet: !!flags.quiet,
      });
      break;

    case "query":
      await queryCommand({
        source: flags.source as string,
        unread: !!flags.unread,
        triaged: !!flags.triaged,
        untriaged: !!flags.untriaged,
        priority: flags.priority as string,
        category: flags.category as string,
        since: flags.since as string,
        limit: flags.limit ? parseInt(flags.limit as string) : undefined,
        json: !!flags.json,
      });
      break;

    case "stats":
      await statsCommand({
        source: flags.source as string,
        json: !!flags.json,
      });
      break;

    case "mark-read":
      await markReadCommand(positional[0], {
        source: flags.source as string,
      });
      break;

    case "triage":
      if (!positional[0]) {
        console.error("Usage: inbox triage <item-id> [options]");
        process.exit(1);
      }
      await triageCommand(positional[0], {
        priority: flags.priority as string,
        category: flags.category as string,
        confidence: flags.confidence ? parseInt(flags.confidence as string) : undefined,
        quickWin: !!flags["quick-win"],
        quickWinReason: flags["quick-win-reason"] as string,
        estimatedTime: flags["estimated-time"] as string,
        reasoning: flags.reasoning as string,
        suggestedAction: flags["suggested-action"] as string,
      });
      break;

    case "help":
    default:
      console.log(`
UnifiedInbox CLI - Unified inbox operations for all message sources

Usage:
  inbox sync [options]              Sync items from sources
  inbox query [options]             Query cached items
  inbox stats [options]             Show statistics
  inbox mark-read <id> [options]    Mark item as read
  inbox triage <id> [options]       Set triage results

Sync Options:
  --source <sources>    Comma-separated source names
  --since <time>        Only sync items since (e.g., "1 day ago")
  --dry-run             Show what would sync without saving
  --quiet               Minimal output

Query Options:
  --source <sources>    Filter by source
  --unread              Only unread items
  --triaged             Only triaged items
  --untriaged           Only untriaged items
  --priority <p>        Filter by priority (P0,P1,P2,P3)
  --category <c>        Filter by category
  --since <time>        Items since time
  --limit <n>           Max items to return (default: 50)
  --json                Output as JSON

Stats Options:
  --source <source>     Stats for specific source
  --json                Output as JSON

Mark-Read Options:
  --source <source>     Mark all items from source as read

Triage Options:
  --priority <p>        P0, P1, P2, or P3
  --category <c>        Action-Required, FYI, Delegatable, Spam, Archive
  --confidence <n>      1-10 confidence score
  --quick-win           Mark as quick win
  --quick-win-reason    Why it's a quick win
  --estimated-time      5min, 15min, 30min, 1hr, 2hr+
  --reasoning           AI/user reasoning
  --suggested-action    Suggested next action

Supported Sources:
  email-ms365, email-gmail, slack, telegram, sdp-ticket, sdp-task
`);
  }
}

main().catch(console.error);
