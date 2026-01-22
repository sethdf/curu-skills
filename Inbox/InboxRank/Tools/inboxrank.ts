#!/usr/bin/env bun
/**
 * InboxRank CLI - Layer 3: AI Prompting
 *
 * AI-powered inbox categorization built on top of UnifiedInbox (Layer 2).
 *
 * Usage:
 *   inboxrank                         # Triage untriaged items
 *   inboxrank --source slack          # Triage specific source
 *   inboxrank --limit 20              # Limit items to process
 *   inboxrank --dry-run               # Show results without saving
 *   inboxrank --verbose               # Show AI reasoning
 *   inboxrank report                  # Generate triage report
 *   inboxrank suggest                 # Get next-action suggestion
 *   inboxrank review                  # Interactive review
 */

import { $ } from "bun";
import type { Item } from "../../../_shared/api/types.ts";
import { categorizeBatch, type CategorizationResult } from "./categorizer.ts";
import { getPriorityDescription } from "./scoring.ts";

// Path to UnifiedInbox CLI
const INBOX_CLI = Bun.env.HOME + "/repos/github.com/sethdf/curu-skills/Inbox/UnifiedInbox/Tools/inbox.ts";

// Default batch size
const DEFAULT_LIMIT = 10;

interface CliOptions {
  source?: string;
  limit: number;
  dryRun: boolean;
  verbose: boolean;
  json: boolean;
  quickWins: boolean;
  priority?: string;
  format?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; options: CliOptions } {
  const args = process.argv.slice(2);
  let command = "rank"; // default command

  const options: CliOptions = {
    limit: DEFAULT_LIMIT,
    dryRun: false,
    verbose: false,
    json: false,
    quickWins: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Commands
    if (arg === "report" || arg === "suggest" || arg === "review") {
      command = arg;
      continue;
    }

    // Options
    if (arg === "--source" || arg === "-s") {
      options.source = args[++i];
    } else if (arg === "--limit" || arg === "-l") {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === "--dry-run" || arg === "-n") {
      options.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--quick-wins" || arg === "--quick") {
      options.quickWins = true;
    } else if (arg === "--priority" || arg === "-p") {
      options.priority = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      options.format = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { command, options };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
InboxRank - AI-powered inbox categorization

Usage:
  inboxrank [command] [options]

Commands:
  (default)     Triage untriaged items
  report        Generate triage report
  suggest       Get next-action suggestion
  review        Interactive review of triaged items

Options:
  --source, -s  Filter by source (e.g., slack, email-ms365)
  --limit, -l   Maximum items to process (default: ${DEFAULT_LIMIT})
  --dry-run, -n Show results without saving
  --verbose, -v Show AI reasoning
  --json        Output in JSON format
  --quick-wins  Only show/process quick wins
  --priority -p Filter by priority (P0, P1, P2, P3)
  --format, -f  Report format (md, json)
  --help, -h    Show this help

Examples:
  inboxrank                         # Triage up to 10 untriaged items
  inboxrank --source slack --limit 5
  inboxrank --dry-run --verbose     # Preview without saving
  inboxrank report --format md      # Generate markdown report
  inboxrank suggest --quick-wins    # Get quick win suggestions
`);
}

/**
 * Map database row (snake_case) to Item type (camelCase)
 */
function mapDbRowToItem(row: Record<string, unknown>): Item {
  return {
    id: row.id as string,
    source: row.source as Item["source"],
    sourceId: (row.source_id || row.sourceId) as string,
    itemType: (row.item_type || row.itemType || "message") as Item["itemType"],
    timestamp: new Date((row.timestamp as string) || Date.now()),
    from: {
      name: (row.from_name || row.fromName) as string | null,
      address: (row.from_address || row.fromAddress) as string | null,
      userId: (row.from_user_id || row.fromUserId) as string | null,
    },
    subject: (row.subject as string) || null,
    body: (row.body as string) || null,
    bodyPreview: (row.body_preview || row.bodyPreview) as string | null,
    threadId: (row.thread_id || row.threadId) as string | null,
    threadContext: null, // Not needed for categorization
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
    readStatus: ((row.read_status || row.readStatus) as Item["readStatus"]) || "unread",
    createdAt: new Date((row.created_at || row.createdAt) as string || Date.now()),
    updatedAt: new Date((row.updated_at || row.updatedAt) as string || Date.now()),
  };
}

/**
 * Query items from UnifiedInbox
 */
async function queryItems(options: CliOptions, untriaged: boolean = true): Promise<Item[]> {
  let cmd = `bun ${INBOX_CLI} query --json`;

  if (untriaged) {
    cmd += " --untriaged";
  } else {
    cmd += " --triaged";
  }

  if (options.source) {
    cmd += ` --source ${options.source}`;
  }

  cmd += ` --limit ${options.limit}`;

  try {
    const result = await $`sh -c ${cmd}`.text();
    const rows = JSON.parse(result) as Record<string, unknown>[];
    // Map snake_case database rows to camelCase Item type
    return rows.map(mapDbRowToItem);
  } catch (error) {
    if (options.verbose) {
      console.error("[query] Error:", error);
    }
    return [];
  }
}

/**
 * Check if sender is VIP via UnifiedInbox
 */
async function isVipSender(item: Item): Promise<boolean> {
  // Call inbox CLI to check VIP status
  // For now, return false - the database check happens in the inbox CLI
  // This could be enhanced to cache VIP lookups
  return false;
}

/**
 * Write triage results back to UnifiedInbox
 */
async function writeTriage(result: CategorizationResult, dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  const cmd = [
    "bun",
    INBOX_CLI,
    "triage",
    result.itemId,
    "--priority",
    result.priority,
    "--category",
    result.category,
    "--confidence",
    result.confidence.toString(),
    "--reasoning",
    result.reasoning.substring(0, 500), // Truncate to avoid shell issues
  ];

  if (result.quickWin) {
    cmd.push("--quick-win");
    if (result.quickWinReason) {
      cmd.push("--quick-win-reason", result.quickWinReason);
    }
  }

  cmd.push("--estimated-time", result.estimatedTime);
  cmd.push("--suggested-action", result.suggestedAction.substring(0, 200));

  await $`${cmd}`.quiet();
}

/**
 * Format a single result for display
 */
function formatResult(result: CategorizationResult, item: Item, verbose: boolean): string {
  const lines: string[] = [];

  const priorityColor = {
    P0: "\x1b[31m", // Red
    P1: "\x1b[33m", // Yellow
    P2: "\x1b[36m", // Cyan
    P3: "\x1b[37m", // White
  }[result.priority] || "\x1b[37m";

  const reset = "\x1b[0m";

  lines.push(
    `${priorityColor}[${result.priority}]${reset} ${result.category} | ${item.source}`
  );
  lines.push(`  From: ${item.fromName || item.fromAddress || "unknown"}`);
  lines.push(`  Subject: ${item.subject || "(no subject)"}`);

  if (result.quickWin) {
    lines.push(`  ⚡ Quick Win: ${result.quickWinReason}`);
  }

  if (verbose) {
    lines.push(`  Reasoning: ${result.reasoning}`);
    lines.push(`  Suggested: ${result.suggestedAction}`);
    lines.push(`  Confidence: ${result.confidence}/10`);
    lines.push(
      `  Score: ${result.scoring.totalScore} (base: ${result.scoring.baseScore}, modifiers: ${result.scoring.modifiers.map((m) => m.name).join(", ") || "none"})`
    );
  }

  lines.push(`  Time: ${result.estimatedTime} | ID: ${result.itemId}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Main rank command - triage untriaged items
 */
async function commandRank(options: CliOptions): Promise<void> {
  console.log("Fetching untriaged items...");

  const items = await queryItems(options, true);

  if (items.length === 0) {
    console.log("No untriaged items found.");
    return;
  }

  console.log(`Found ${items.length} items to triage.`);

  if (options.verbose) {
    console.log("Running AI categorization...");
  }

  const results = await categorizeBatch(items, isVipSender, {
    verbose: options.verbose,
    batchSize: 5,
    delayMs: 500,
  });

  // Build item lookup
  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Sort by priority (P0 first)
  results.sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return order[a.priority] - order[b.priority];
  });

  // Filter quick wins if requested
  const displayResults = options.quickWins
    ? results.filter((r) => r.quickWin)
    : results;

  if (options.json) {
    console.log(JSON.stringify(displayResults, null, 2));
  } else {
    console.log("\n" + "=".repeat(60));
    console.log("TRIAGE RESULTS");
    console.log("=".repeat(60) + "\n");

    for (const result of displayResults) {
      const item = itemMap.get(result.itemId);
      if (item) {
        console.log(formatResult(result, item, options.verbose));
      }
    }

    // Summary
    const byPriority = {
      P0: results.filter((r) => r.priority === "P0").length,
      P1: results.filter((r) => r.priority === "P1").length,
      P2: results.filter((r) => r.priority === "P2").length,
      P3: results.filter((r) => r.priority === "P3").length,
    };
    const quickWins = results.filter((r) => r.quickWin).length;

    console.log("=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `Total: ${results.length} | P0: ${byPriority.P0} | P1: ${byPriority.P1} | P2: ${byPriority.P2} | P3: ${byPriority.P3}`
    );
    console.log(`Quick Wins: ${quickWins}`);

    if (options.dryRun) {
      console.log("\n[DRY RUN] No changes saved.");
    }
  }

  // Write results to database
  if (!options.dryRun) {
    console.log("\nSaving triage results...");
    for (const result of results) {
      await writeTriage(result, false);
    }
    console.log("Done.");
  }
}

/**
 * Report command - generate triage report
 */
async function commandReport(options: CliOptions): Promise<void> {
  // Query triaged items
  const items = await queryItems({ ...options, limit: 100 }, false);

  if (items.length === 0) {
    console.log("No triaged items found.");
    return;
  }

  // Get triage data for each item
  const triageData: Array<{ item: Item; triage: any }> = [];

  for (const item of items) {
    // Query triage info via inbox CLI
    try {
      const result = await $`bun ${INBOX_CLI} query --json --limit 1`.text();
      // For now, just use the item - triage data would come from the query
      triageData.push({ item, triage: {} });
    } catch {
      triageData.push({ item, triage: {} });
    }
  }

  const format = options.format || "md";

  if (format === "json" || options.json) {
    console.log(JSON.stringify(triageData, null, 2));
  } else {
    // Markdown report
    console.log("# Inbox Triage Report");
    console.log(`\nGenerated: ${new Date().toISOString()}`);
    console.log(`\nTotal items: ${items.length}`);

    // Group by source
    const bySource = new Map<string, Item[]>();
    for (const item of items) {
      const list = bySource.get(item.source) || [];
      list.push(item);
      bySource.set(item.source, list);
    }

    console.log("\n## By Source\n");
    for (const [source, sourceItems] of bySource) {
      console.log(`- **${source}**: ${sourceItems.length} items`);
    }

    console.log("\n## Recent Items\n");
    for (const item of items.slice(0, 20)) {
      console.log(`- [${item.source}] ${item.subject || "(no subject)"}`);
      console.log(`  From: ${item.fromName || "unknown"} | ${item.timestamp}`);
    }
  }
}

/**
 * Suggest command - get next action suggestion
 */
async function commandSuggest(options: CliOptions): Promise<void> {
  // Query triaged, unread items sorted by priority
  let cmd = `bun ${INBOX_CLI} query --json --triaged --unread --limit 20`;

  if (options.source) {
    cmd += ` --source ${options.source}`;
  }

  if (options.priority) {
    cmd += ` --priority ${options.priority}`;
  }

  try {
    const result = await $`sh -c ${cmd}`.text();
    const items: Item[] = JSON.parse(result);

    if (items.length === 0) {
      console.log("No action items found. Inbox zero! 🎉");
      return;
    }

    // The items should already be sorted by priority from the query
    // Filter for quick wins if requested
    const displayItems = options.quickWins
      ? items.filter((i) => (i.metadata as any)?.quickWin === true)
      : items;

    if (displayItems.length === 0) {
      console.log("No quick wins found.");
      return;
    }

    console.log("\n📋 SUGGESTED NEXT ACTIONS\n");

    for (let i = 0; i < Math.min(5, displayItems.length); i++) {
      const item = displayItems[i];
      const meta = item.metadata as any;

      console.log(`${i + 1}. [${meta?.priority || "?"}] ${item.subject || "(no subject)"}`);
      console.log(`   From: ${item.fromName || "unknown"} | ${item.source}`);
      if (meta?.suggestedAction) {
        console.log(`   Action: ${meta.suggestedAction}`);
      }
      if (meta?.quickWin) {
        console.log(`   ⚡ Quick Win (${meta.estimatedTime || "5min"})`);
      }
      console.log("");
    }

    console.log(`Total pending: ${items.length} items`);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
  }
}

/**
 * Review command - interactive review of triaged items
 */
async function commandReview(options: CliOptions): Promise<void> {
  console.log("Interactive review mode.");
  console.log("(This would launch an interactive TUI for reviewing triage decisions.)");
  console.log("\nTo review triaged items, use:");
  console.log("  inboxrank report --format md");
  console.log("\nTo re-triage specific sources:");
  console.log("  inboxrank --source slack --dry-run --verbose");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, options } = parseArgs();

  switch (command) {
    case "rank":
      await commandRank(options);
      break;
    case "report":
      await commandReport(options);
      break;
    case "suggest":
      await commandSuggest(options);
      break;
    case "review":
      await commandReview(options);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
