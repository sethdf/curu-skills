#!/usr/bin/env bun
/**
 * recent-work.ts - Show recent PAI work sessions
 *
 * Usage: bun run recent-work.ts [--limit N] [--filter PATTERN] [--cwd PATH]
 *
 * Scans ~/.claude/MEMORY/WORK/ for recent sessions and displays them.
 * If --cwd is provided, shows work from that directory first, then global.
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const HOME = process.env.HOME || "/home/ubuntu";
const WORK_DIR = join(HOME, ".claude/MEMORY/WORK");
const CURRENT_SESSION_FILE = join(HOME, ".claude/.current-session");

/**
 * Get cwd from .current-session file (same source as AutoWorkCreation)
 */
function getSessionCwd(): string | undefined {
  try {
    if (existsSync(CURRENT_SESSION_FILE)) {
      const session = JSON.parse(readFileSync(CURRENT_SESSION_FILE, "utf-8"));
      return session.cwd;
    }
  } catch {
    // Silently fail
  }
  return undefined;
}

interface WorkMeta {
  id: string;
  title: string;
  created_at: string;
  status: string;
  session_id?: string;
  cwd?: string; // Added for folder-aware filtering
}

function getRecentWork(limit: number = 5, filter?: string, cwd?: string): WorkMeta[] {
  try {
    const dirs = readdirSync(WORK_DIR)
      .filter((d) => d.match(/^\d{8}-\d{6}_/)) // Match timestamp format
      .sort()
      .reverse(); // Most recent first

    const results: WorkMeta[] = [];
    const cwdResults: WorkMeta[] = [];

    for (const dir of dirs) {
      // Stop early if we have enough results
      if (results.length >= limit && (!cwd || cwdResults.length >= limit)) break;

      const metaPath = join(WORK_DIR, dir, "META.yaml");
      try {
        const content = readFileSync(metaPath, "utf-8");
        const meta = parseYaml(content) as WorkMeta;

        // Apply text filter if provided
        if (filter && !meta.title.toLowerCase().includes(filter.toLowerCase())) {
          continue;
        }

        // Track cwd-specific results separately
        if (cwd && meta.cwd && meta.cwd.startsWith(cwd)) {
          if (cwdResults.length < limit) {
            cwdResults.push(meta);
          }
        }

        // Also collect global results as fallback
        if (results.length < limit) {
          results.push(meta);
        }
      } catch {
        // Skip if META.yaml doesn't exist or is invalid
        continue;
      }
    }

    // Return cwd-specific results if we have any, otherwise global
    if (cwd && cwdResults.length > 0) {
      return cwdResults;
    }
    return results;
  } catch (error) {
    console.error("Failed to read work directory:", error);
    return [];
  }
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

function main() {
  const args = process.argv.slice(2);
  let limit = 5;
  let filter: string | undefined;
  let cwd: string | undefined;
  let autoDetectCwd = true; // Auto-detect cwd from session by default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === "--filter" && args[i + 1]) {
      filter = args[i + 1];
      i++;
    } else if (args[i] === "--cwd" && args[i + 1]) {
      cwd = args[i + 1];
      autoDetectCwd = false;
      i++;
    } else if (args[i] === "--global") {
      autoDetectCwd = false; // Disable auto-detection, show all work
    }
  }

  // Auto-detect cwd from current session if not explicitly provided
  if (autoDetectCwd && !cwd) {
    cwd = getSessionCwd();
  }

  const work = getRecentWork(limit, filter, cwd);

  if (work.length === 0) {
    console.log("No recent work sessions found.");
    return;
  }

  for (const item of work) {
    const status = item.status === "ACTIVE" ? "🔄" : "✅";
    const time = formatDate(item.created_at);
    // Truncate title to fit nicely
    const title = item.title.length > 50 ? item.title.slice(0, 47) + "..." : item.title;
    console.log(`${status} ${time.padEnd(10)} ${title}`);
  }
}

main();
