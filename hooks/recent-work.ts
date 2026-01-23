#!/usr/bin/env bun
/**
 * recent-work.ts - Show recent PAI work sessions
 *
 * Usage: bun run recent-work.ts [--limit N] [--filter PATTERN]
 *
 * Scans ~/.claude/MEMORY/WORK/ for recent sessions and displays them.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const WORK_DIR = join(process.env.HOME || "/home/ubuntu", ".claude/MEMORY/WORK");

interface WorkMeta {
  id: string;
  title: string;
  created_at: string;
  status: string;
  session_id?: string;
}

function getRecentWork(limit: number = 5, filter?: string): WorkMeta[] {
  try {
    const dirs = readdirSync(WORK_DIR)
      .filter((d) => d.match(/^\d{8}-\d{6}_/)) // Match timestamp format
      .sort()
      .reverse(); // Most recent first

    const results: WorkMeta[] = [];

    for (const dir of dirs) {
      if (results.length >= limit) break;

      const metaPath = join(WORK_DIR, dir, "META.yaml");
      try {
        const content = readFileSync(metaPath, "utf-8");
        const meta = parseYaml(content) as WorkMeta;

        // Apply filter if provided
        if (filter && !meta.title.toLowerCase().includes(filter.toLowerCase())) {
          continue;
        }

        results.push(meta);
      } catch {
        // Skip if META.yaml doesn't exist or is invalid
        continue;
      }
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === "--filter" && args[i + 1]) {
      filter = args[i + 1];
      i++;
    }
  }

  const work = getRecentWork(limit, filter);

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
