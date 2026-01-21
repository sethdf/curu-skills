#!/usr/bin/env bun
/**
 * AutoTriage.ts - Headless message triage for cron/scheduled execution
 *
 * Standalone CLI that can run without a Claude Code session.
 * Exports messages, applies AI categorization, and optionally notifies.
 *
 * Usage:
 *   bun AutoTriage.ts --source email [options]
 *   bun AutoTriage.ts --source slack --channel general [options]
 *
 * Options:
 *   --source <email|slack>     Message source (required)
 *   --channel <name>           Slack channel (required for slack)
 *   --cached                   Query cached results only (instant, default for interactive)
 *   --fresh                    Force fresh export and categorization (default for cron)
 *   --limit <n>                Max messages to process (default: 100)
 *   --notify                   Send notification on completion
 *   --dry-run                  Export and categorize but don't apply
 *   --quiet                    Minimal output (for cron)
 *   --verbose                  Detailed output for debugging
 *   --help                     Show this help
 *
 * Environment:
 *   MS365_USER                 MS365 user email (default: sfoley@buxtonco.com)
 *   SLACK_ARCHIVE              Path to slackdump SQLite (default: ~/slack-archive/slackdump.sqlite)
 *   TRIAGE_CACHE               Path to cache DB (default: ~/.cache/message-triage/messages.sqlite)
 *   NOTIFY_URL                 Notification endpoint (default: http://localhost:8888/notify)
 *
 * @author PAI System
 * @version 1.0.0
 */

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// Configuration
const config = {
  ms365User: process.env.MS365_USER || "sfoley@buxtonco.com",
  slackArchive: process.env.SLACK_ARCHIVE || join(homedir(), "slack-archive/slackdump.sqlite"),
  cacheDir: process.env.TRIAGE_CACHE?.replace("/messages.sqlite", "") || join(homedir(), ".cache/message-triage"),
  cacheDb: process.env.TRIAGE_CACHE || join(homedir(), ".cache/message-triage/messages.sqlite"),
  notifyUrl: process.env.NOTIFY_URL || "http://localhost:8888/notify",
  inferenceScript: join(homedir(), ".claude/skills/CORE/Tools/Inference.ts"),
};

// Parse CLI arguments
function parseArgs(): {
  source: "email" | "slack";
  channel?: string;
  limit: number;
  notify: boolean;
  dryRun: boolean;
  cached: boolean;
  fresh: boolean;
  categorizePending: boolean;
  quiet: boolean;
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    source: "email" as "email" | "slack",
    channel: undefined as string | undefined,
    limit: 100,
    notify: false,
    dryRun: false,
    cached: false,
    fresh: false,
    categorizePending: false,
    quiet: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--source":
        result.source = args[++i] as "email" | "slack";
        break;
      case "--channel":
        result.channel = args[++i];
        break;
      case "--limit":
        result.limit = parseInt(args[++i], 10);
        break;
      case "--notify":
        result.notify = true;
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--cached":
        result.cached = true;
        break;
      case "--fresh":
        result.fresh = true;
        break;
      case "--categorize-pending":
        result.categorizePending = true;
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

function log(message: string, opts: { quiet: boolean; verbose: boolean }, level: "info" | "debug" | "success" | "warn" | "error" = "info") {
  if (opts.quiet && level !== "error") return;
  if (level === "debug" && !opts.verbose) return;

  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    debug: `${colors.dim}[DEBUG]${colors.reset}`,
    success: `${colors.green}[OK]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
  }[level];

  console.log(`${prefix} ${message}`);
}

function showHelp() {
  console.log(`
${colors.cyan}AutoTriage${colors.reset} - Headless message triage for cron/scheduled execution

${colors.yellow}USAGE:${colors.reset}
  bun AutoTriage.ts --source email [options]
  bun AutoTriage.ts --source email --cached           # Instant: query cache only
  bun AutoTriage.ts --source slack --channel general  # Fresh: export + categorize

${colors.yellow}OPTIONS:${colors.reset}
  --source <email|slack>     Message source (required)
  --channel <name>           Slack channel (required for slack fresh mode)
  --cached                   Query cached results only (instant, no API calls)
  --fresh                    Force fresh export and AI categorization
  --limit <n>                Max messages to process (default: 100)
  --notify                   Send notification on completion
  --dry-run                  Export and categorize but don't apply
  --quiet                    Minimal output (for cron)
  --verbose                  Detailed output for debugging
  --help                     Show this help

${colors.yellow}MODES:${colors.reset}
  ${colors.green}--cached${colors.reset}              Instant results from SQLite cache (use for interactive queries)
  ${colors.green}--fresh${colors.reset}               Full export + AI categorization (use for cron background jobs)
  ${colors.green}--categorize-pending${colors.reset}  Categorize uncategorized messages (for Socket Mode Slack)

${colors.yellow}EXAMPLES:${colors.reset}
  # Interactive: instant cached results
  bun AutoTriage.ts --source email --cached

  # Background: fresh export + categorize
  bun AutoTriage.ts --source email --limit 50 --notify

  # Slack cached results
  bun AutoTriage.ts --source slack --cached

${colors.yellow}CRON SETUP (recommended):${colors.reset}
  # Email: every 5 minutes
  */5 * * * * bun /path/to/AutoTriage.ts --source email --quiet

  # Slack: every 60 seconds
  * * * * * bun /path/to/AutoTriage.ts --source slack --channel general --quiet

${colors.yellow}ENVIRONMENT:${colors.reset}
  MS365_USER      MS365 user email (default: sfoley@buxtonco.com)
  SLACK_ARCHIVE   Path to slackdump SQLite
  TRIAGE_CACHE    Path to cache DB
  NOTIFY_URL      Notification endpoint
`);
}

// Initialize SQLite cache database
async function initCache(opts: { quiet: boolean; verbose: boolean }) {
  if (!existsSync(config.cacheDir)) {
    mkdirSync(config.cacheDir, { recursive: true });
    log(`Created cache directory: ${config.cacheDir}`, opts, "debug");
  }

  await $`sqlite3 ${config.cacheDb} "
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      timestamp TEXT,
      from_name TEXT,
      from_address TEXT,
      subject TEXT,
      body TEXT,
      body_preview TEXT,
      thread_id TEXT,
      is_read INTEGER DEFAULT 0,
      category TEXT,
      confidence INTEGER,
      reasoning TEXT,
      exported_at TEXT DEFAULT CURRENT_TIMESTAMP,
      run_id TEXT,
      -- Slack-specific fields
      channel_id TEXT,
      channel_name TEXT,
      channel_type TEXT,
      user_id TEXT,
      triage_status TEXT DEFAULT 'unread',
      context_messages TEXT,
      raw_event TEXT
    );
    CREATE TABLE IF NOT EXISTS thread_context (
      message_id TEXT,
      position INTEGER,
      from_name TEXT,
      from_address TEXT,
      body_preview TEXT,
      timestamp TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id)
    );
    CREATE TABLE IF NOT EXISTS triage_runs (
      id TEXT PRIMARY KEY,
      source TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      messages_processed INTEGER,
      categories_applied INTEGER,
      status TEXT DEFAULT 'running'
    );
    CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source);
    CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);
    CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id);
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_triage_status ON messages(triage_status);
  "`.quiet();

  log("Cache database initialized", opts, "debug");
}

// Export messages from MS365
async function exportEmail(limit: number, runId: string, opts: { quiet: boolean; verbose: boolean }): Promise<number> {
  log("Exporting emails from MS365...", opts);

  // Get unread inbox messages via auth-keeper
  // Write PowerShell command to temp file to avoid shell escaping issues
  const tempFile = `/tmp/autotriage-${runId}.ps1`;
  const psCommand = `
$inbox = Get-MgUserMailFolder -UserId '${config.ms365User}' | Where-Object { $_.DisplayName -eq 'Inbox' }
Get-MgUserMailFolderMessage -UserId '${config.ms365User}' -MailFolderId $inbox.Id -Filter 'isRead eq false' -Top ${limit} -Select 'id,subject,from,receivedDateTime,bodyPreview,conversationId,isRead' | ConvertTo-Json -Depth 5
`.trim();

  await Bun.write(tempFile, psCommand);

  // Source auth-keeper and run the temp script
  const authKeeperScript = join(homedir(), "repos/github.com/sethdf/imladris/scripts/auth-keeper.sh");
  const result = await $`bash -c 'source ${authKeeperScript} && _ak_ms365_cmd "$(cat ${tempFile})"'`.text();

  // Clean up temp file
  await $`rm -f ${tempFile}`.quiet();

  let messages: any[];
  try {
    const parsed = JSON.parse(result);
    messages = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    log(`Failed to parse MS365 response: ${e}`, opts, "error");
    return 0;
  }

  log(`Retrieved ${messages.length} unread emails`, opts, "debug");

  // Insert into cache
  // MS365 returns PascalCase fields (Id, Subject, From, etc.)
  for (const msg of messages) {
    if (!msg || !msg.Id) continue;

    const id = msg.Id;
    const subject = (msg.Subject || "").replace(/'/g, "''");
    const fromName = (msg.From?.EmailAddress?.Name || "").replace(/'/g, "''");
    const fromAddr = msg.From?.EmailAddress?.Address || "";
    const timestamp = msg.ReceivedDateTime || "";
    const preview = (msg.BodyPreview || "").replace(/'/g, "''");
    const threadId = msg.ConversationId || "";
    const isRead = msg.IsRead ? 1 : 0;

    await $`sqlite3 ${config.cacheDb} "
      INSERT OR REPLACE INTO messages (id, source, timestamp, from_name, from_address, subject, body_preview, thread_id, is_read, run_id)
      VALUES ('${id}', 'email', '${timestamp}', '${fromName}', '${fromAddr}', '${subject}', '${preview}', '${threadId}', ${isRead}, '${runId}');
    "`.quiet();
  }

  log(`Exported ${messages.length} emails to cache`, opts, "success");
  return messages.length;
}

// Export messages from Slack (all channels, DMs, and group DMs)
async function exportSlack(channel: string | undefined, limit: number, runId: string, opts: { quiet: boolean; verbose: boolean }): Promise<number> {
  log(`Exporting messages from Slack (all conversations)...`, opts);

  if (!existsSync(config.slackArchive)) {
    log(`Slack archive not found: ${config.slackArchive}`, opts, "error");
    return 0;
  }

  // First sync latest from slackdump
  try {
    await $`slackdump resume ${config.slackArchive.replace("/slackdump.sqlite", "")}`.quiet();
  } catch (e) {
    log(`Slackdump sync skipped (may already be running)`, opts, "debug");
  }

  // Export from slackdump - ALL conversations including DMs
  // Channel types: C=public channel, G=private/mpim, D=DM
  const result = await $`sqlite3 -json ${config.slackArchive} "
    SELECT
      m.channel_id || '-' || m.ts AS id,
      'slack' AS source,
      datetime(CAST(m.ts AS REAL), 'unixepoch') AS timestamp,
      COALESCE(u.real_name, u.name, m.user) AS from_name,
      m.user AS from_address,
      CASE
        WHEN c.id LIKE 'D%' THEN 'DM: ' || COALESCE(u.real_name, u.name, 'Unknown')
        WHEN c.id LIKE 'G%' THEN 'Group: ' || COALESCE(c.name, 'Private')
        ELSE '#' || COALESCE(c.name, 'Unknown')
      END AS subject,
      m.text AS body_preview,
      COALESCE(m.thread_ts, m.ts) AS thread_id,
      c.id AS channel_id,
      c.name AS channel_name,
      CASE
        WHEN c.id LIKE 'D%' THEN 'im'
        WHEN c.id LIKE 'G%' THEN 'mpim'
        ELSE 'channel'
      END AS channel_type
    FROM MESSAGE m
    LEFT JOIN S_USER u ON m.user = u.id
    LEFT JOIN CHANNEL c ON m.channel_id = c.id
    WHERE datetime(CAST(m.ts AS REAL), 'unixepoch') > datetime('now', '-24 hours')
      AND m.text IS NOT NULL
      AND m.text != ''
    ORDER BY m.ts DESC
    LIMIT ${limit};
  "`.text();

  let messages: any[];
  try {
    messages = JSON.parse(result);
  } catch (e) {
    log(`Failed to parse Slack data (may be empty): ${e}`, opts, "debug");
    return 0;
  }

  if (messages.length === 0) {
    log("No new Slack messages in last 24 hours", opts, "debug");
    return 0;
  }

  // Insert into cache
  for (const msg of messages) {
    const id = (msg.id || "").replace(/'/g, "''");
    const subject = (msg.subject || "").replace(/'/g, "''");
    const fromName = (msg.from_name || "").replace(/'/g, "''");
    const fromAddr = msg.from_address || "";
    const timestamp = msg.timestamp || "";
    const preview = (msg.body_preview || "").replace(/'/g, "''").substring(0, 500);
    const threadId = (msg.thread_id || "").replace(/'/g, "''");
    const channelId = msg.channel_id || "";
    const channelName = (msg.channel_name || "").replace(/'/g, "''");
    const channelType = msg.channel_type || "channel";

    await $`sqlite3 ${config.cacheDb} "
      INSERT OR REPLACE INTO messages (id, source, timestamp, from_name, from_address, subject, body_preview, thread_id, is_read, run_id, channel_id, channel_name, channel_type)
      VALUES ('${id}', 'slack', '${timestamp}', '${fromName}', '${fromAddr}', '${subject}', '${preview}', '${threadId}', 0, '${runId}', '${channelId}', '${channelName}', '${channelType}');
    "`.quiet();
  }

  // Log breakdown
  const dms = messages.filter((m: any) => m.channel_type === 'im').length;
  const mpims = messages.filter((m: any) => m.channel_type === 'mpim').length;
  const channels = messages.filter((m: any) => m.channel_type === 'channel').length;
  log(`Exported ${messages.length} Slack messages (${dms} DMs, ${mpims} group DMs, ${channels} channels)`, opts, "success");

  return messages.length;
}

// Categorize messages using PAI Inference
const BATCH_SIZE = 15;  // Process 15 messages at a time to avoid timeouts

async function categorizeMessages(runId: string, opts: { quiet: boolean; verbose: boolean }, source?: string): Promise<number> {
  log("Running AI categorization...", opts);

  // Get uncategorized messages from this run (or by source if no runId)
  const whereClause = runId
    ? `run_id = '${runId}' AND category IS NULL`
    : source
      ? `source = '${source}' AND category IS NULL`
      : `category IS NULL`;

  const messagesRaw = await $`sqlite3 -json ${config.cacheDb} "
    SELECT id, source, from_name, from_address, subject, body_preview, thread_id,
           channel_name, channel_type, context_messages
    FROM messages
    WHERE ${whereClause};
  "`.text();

  let messages: any[];
  try {
    messages = JSON.parse(messagesRaw);
  } catch (e) {
    log(`No messages to categorize`, opts, "debug");
    return 0;
  }

  if (messages.length === 0) {
    log("No uncategorized messages found", opts, "debug");
    return 0;
  }

  // Category definitions - unified for email and Slack
  const categories = `
- Action-Required: Needs direct response or action from user (questions, requests, approvals)
- Colleagues: Direct messages from team members (not automated)
- Support-Request: Customer or internal support requests
- Discussion: Ongoing conversations, brainstorming, general chat
- SaaS-Notifications: Automated alerts from SaaS tools (monitoring, CI/CD, security, bots)
- AWS-Cloud: Cloud infrastructure notifications
- FYI-Internal: Internal notifications, announcements, no action needed
- Vendor-Sales: Sales and marketing from external vendors
- Noise: Low-value automated messages, join/leave notifications, reactions`;

  const systemPrompt = `You are a message categorization assistant. Categorize messages (email or Slack) into these categories:
${categories}

Return ONLY a valid JSON array with this structure:
[{"id": "msg-id", "category": "Category-Name", "confidence": 8, "reasoning": "brief reason"}]

Rules:
- confidence is 1-10 (10 = very certain)
- reasoning should be 5-15 words
- Use exact category names from the list above
- For Slack: consider context messages to understand the conversation
- DMs asking questions = Action-Required
- Thread replies that are just acknowledgments = FYI-Internal
- Bot messages or automated notifications = SaaS-Notifications or Noise`;

  // Import inference module once
  const { inference } = await import(config.inferenceScript);

  // Process in batches
  const totalBatches = Math.ceil(messages.length / BATCH_SIZE);
  log(`Categorizing ${messages.length} messages in ${totalBatches} batches...`, opts, "debug");

  let totalCategorized = 0;

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const start = batchNum * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, messages.length);
    const batch = messages.slice(start, end);

    log(`Processing batch ${batchNum + 1}/${totalBatches} (${batch.length} messages)...`, opts, "debug");

    const messageList = batch
      .map((m: any, i: number) => {
        let formatted = `
### Message ${i + 1}
**ID:** ${m.id}
**Source:** ${m.source}
**From:** ${m.from_name}${m.from_address ? ` <${m.from_address}>` : ""}
**Subject:** ${m.subject}
**Content:** ${m.body_preview?.substring(0, 200) || ""}`;

        // Add Slack-specific context
        if (m.source === "slack" && m.context_messages) {
          try {
            const ctx = JSON.parse(m.context_messages);
            if (ctx.length > 0) {
              formatted += `\n**Channel:** ${m.channel_name} (${m.channel_type})`;
              formatted += `\n**Context (previous messages):**`;
              for (const c of ctx.slice(-3)) {  // Last 3 context messages
                formatted += `\n  - ${c.from}: ${c.text.substring(0, 100)}`;
              }
            }
          } catch {}
        }

        return formatted;
      })
      .join("\n");

    const userPrompt = `Categorize these messages:\n\n${messageList}`;

    // Call PAI Inference
    const result = await inference({
      systemPrompt,
      userPrompt,
      level: 'standard',
      expectJson: false,
      timeout: 45000,  // 45 seconds per batch
    });

    if (!result.success) {
      log(`Batch ${batchNum + 1} failed: ${result.error}`, opts, "error");
      continue;  // Try next batch
    }

    // Parse JSON from response
    let results: any[];
    try {
      const jsonMatch = result.output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (e) {
      log(`Failed to parse batch ${batchNum + 1}: ${e}`, opts, "error");
      continue;  // Try next batch
    }

    // Update cache with categories
    for (const item of results) {
      if (!item.id || !item.category) continue;

      const category = item.category.replace(/'/g, "''");
      const confidence = item.confidence || 5;
      const reasoning = (item.reasoning || "").replace(/'/g, "''");

      await $`sqlite3 ${config.cacheDb} "
        UPDATE messages
        SET category = '${category}', confidence = ${confidence}, reasoning = '${reasoning}'
        WHERE id = '${item.id}';
      "`.quiet();

      totalCategorized++;
    }

    log(`Batch ${batchNum + 1} complete: ${results.length} categorized`, opts, "debug");
  }

  log(`Categorized ${totalCategorized} messages`, opts, "success");
  return totalCategorized;
}

// Generate summary report
async function generateReport(runId: string, opts: { quiet: boolean; verbose: boolean }): Promise<string> {
  const summary = await $`sqlite3 -column -header ${config.cacheDb} "
    SELECT
      category,
      COUNT(*) as count,
      ROUND(AVG(confidence), 1) as avg_conf
    FROM messages
    WHERE run_id = '${runId}' AND category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC;
  "`.text();

  const actionRequired = await $`sqlite3 ${config.cacheDb} "
    SELECT COUNT(*) FROM messages
    WHERE run_id = '${runId}' AND category = 'Action-Required';
  "`.text();

  const total = await $`sqlite3 ${config.cacheDb} "
    SELECT COUNT(*) FROM messages WHERE run_id = '${runId}';
  "`.text();

  const report = `
=== AutoTriage Report ===
Run ID: ${runId}
Total Messages: ${total.trim()}
Action Required: ${actionRequired.trim()}

${summary}
`;

  if (!opts.quiet) {
    console.log(report);
  }

  return report;
}

// Query cached results (instant - no API calls)
async function queryCached(source: string, opts: { quiet: boolean; verbose: boolean }): Promise<string> {
  log("Querying cached results...", opts);

  // Check last run time
  const lastRun = await $`sqlite3 ${config.cacheDb} "
    SELECT started_at, messages_processed, status
    FROM triage_runs
    WHERE source = '${source}' AND status IN ('completed', 'dry-run')
    ORDER BY started_at DESC
    LIMIT 1;
  "`.text();

  // Get category summary
  const summary = await $`sqlite3 -column -header ${config.cacheDb} "
    SELECT
      category,
      COUNT(*) as count,
      ROUND(AVG(confidence), 1) as avg_conf
    FROM messages
    WHERE source = '${source}'
      AND category IS NOT NULL
      AND exported_at > datetime('now', '-24 hours')
    GROUP BY category
    ORDER BY count DESC;
  "`.text();

  // Get action-required count
  const actionRequired = await $`sqlite3 ${config.cacheDb} "
    SELECT COUNT(*) FROM messages
    WHERE source = '${source}'
      AND category = 'Action-Required'
      AND exported_at > datetime('now', '-24 hours');
  "`.text();

  // Get total count
  const total = await $`sqlite3 ${config.cacheDb} "
    SELECT COUNT(*) FROM messages
    WHERE source = '${source}'
      AND exported_at > datetime('now', '-24 hours');
  "`.text();

  // Get action-required details
  const actionItems = await $`sqlite3 -column -header ${config.cacheDb} "
    SELECT
      substr(from_address, 1, 30) as 'from',
      substr(subject, 1, 50) as subject,
      confidence as conf
    FROM messages
    WHERE source = '${source}'
      AND category = 'Action-Required'
      AND exported_at > datetime('now', '-24 hours')
    ORDER BY confidence DESC, timestamp DESC
    LIMIT 10;
  "`.text();

  const report = `
${colors.cyan}=== MessageTriage Cache Report ===${colors.reset}
${colors.dim}Source: ${source} | Last 24 hours${colors.reset}
${lastRun ? `Last run: ${lastRun.trim()}` : 'No recent runs'}

${colors.yellow}Total Messages:${colors.reset} ${total.trim()}
${colors.red}Action Required:${colors.reset} ${actionRequired.trim()}

${colors.yellow}Category Breakdown:${colors.reset}
${summary || 'No categorized messages found'}

${actionRequired.trim() !== '0' ? `${colors.yellow}Action Required Items:${colors.reset}\n${actionItems}` : ''}
`;

  console.log(report);
  return report;
}

// Send notification
async function sendNotification(report: string, opts: { quiet: boolean; verbose: boolean }) {
  log("Sending notification...", opts, "debug");

  try {
    await fetch(config.notifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `AutoTriage complete. Check report for details.`,
        title: "MessageTriage",
      }),
    });
    log("Notification sent", opts, "success");
  } catch (e) {
    log(`Failed to send notification: ${e}`, opts, "warn");
  }
}

// Main execution
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.source) {
    console.error(`${colors.red}Error: --source is required${colors.reset}`);
    showHelp();
    process.exit(1);
  }

  // Channel is now optional for Slack - exports all conversations if not specified

  const logOpts = { quiet: args.quiet, verbose: args.verbose };

  try {
    // Initialize cache
    await initCache(logOpts);

    // CACHED MODE: Just query existing results (instant)
    if (args.cached) {
      await queryCached(args.source, logOpts);
      process.exit(0);
    }

    // CATEGORIZE-PENDING MODE: Categorize uncategorized messages by source
    // Useful for Slack messages from Socket Mode that don't have a run_id
    if (args.categorizePending) {
      log(`Categorizing pending ${args.source} messages...`, logOpts);
      const categorized = await categorizeMessages("", logOpts, args.source);
      log(`Categorized ${categorized} pending messages`, logOpts, "success");

      if (args.notify) {
        await sendNotification(`Categorized ${categorized} pending ${args.source} messages`, logOpts);
      }

      process.exit(0);
    }

    // FRESH MODE: Full export + categorization
    const runId = `run-${Date.now()}`;
    log(`Starting AutoTriage run: ${runId}`, logOpts);
    log(`Source: ${args.source}, Limit: ${args.limit}, DryRun: ${args.dryRun}`, logOpts, "debug");

    // Record run start
    await $`sqlite3 ${config.cacheDb} "
      INSERT INTO triage_runs (id, source, status)
      VALUES ('${runId}', '${args.source}', 'running');
    "`.quiet();

    // Export messages
    let exported = 0;
    if (args.source === "email") {
      exported = await exportEmail(args.limit, runId, logOpts);
    } else if (args.source === "slack") {
      exported = await exportSlack(args.channel, args.limit, runId, logOpts);
    }

    if (exported === 0) {
      log("No messages to process", logOpts, "warn");
      await $`sqlite3 ${config.cacheDb} "
        UPDATE triage_runs SET status = 'empty', completed_at = datetime('now'), messages_processed = 0
        WHERE id = '${runId}';
      "`.quiet();
      process.exit(0);
    }

    // Categorize
    const categorized = await categorizeMessages(runId, logOpts);

    // Generate report
    const report = await generateReport(runId, logOpts);

    // Update run record
    await $`sqlite3 ${config.cacheDb} "
      UPDATE triage_runs
      SET status = '${args.dryRun ? "dry-run" : "completed"}',
          completed_at = datetime('now'),
          messages_processed = ${exported},
          categories_applied = ${categorized}
      WHERE id = '${runId}';
    "`.quiet();

    // Notify if requested
    if (args.notify) {
      await sendNotification(report, logOpts);
    }

    log(`AutoTriage complete: ${exported} messages processed, ${categorized} categorized`, logOpts, "success");
  } catch (e) {
    log(`AutoTriage failed: ${e}`, logOpts, "error");
    process.exit(1);
  }
}

main();
