/**
 * InboxRank Quick Win Detection
 *
 * Identifies items that can be handled in < 5 minutes.
 */

import type { Item } from "../../../_shared/api/types.ts";

export interface QuickWinResult {
  isQuickWin: boolean;
  reason: string | null;
  estimatedTime: string;
}

// Quick win patterns and their reasons
const QUICK_WIN_PATTERNS = [
  {
    pattern: /\b(yes|no|approve|reject|confirm|deny)\b.*\?/i,
    reason: "Simple yes/no decision",
    time: "2min",
  },
  {
    pattern: /\b(ack|acknowledge|acknowledged|received|got it)\b/i,
    reason: "Acknowledgment needed",
    time: "1min",
  },
  {
    pattern: /\bFYI\b|for your (information|awareness)/i,
    reason: "FYI - no action needed",
    time: "1min",
  },
  {
    pattern: /\b(quick question|one question)\b/i,
    reason: "Quick question to answer",
    time: "3min",
  },
  {
    pattern: /\b(please review|can you review)\b/i,
    reason: "Quick review request",
    time: "5min",
  },
  {
    pattern: /\b(lgtm|looks good|approved|ship it)\b/i,
    reason: "Already approved - just acknowledge",
    time: "1min",
  },
];

// Patterns that indicate NOT a quick win
const NOT_QUICK_WIN_PATTERNS = [
  /\b(meeting|schedule|calendar)\b/i,
  /\b(document|documentation|write up)\b/i,
  /\b(investigate|research|analyze)\b/i,
  /\b(implement|build|create|develop)\b/i,
  /\b(complex|complicated|detailed)\b/i,
  /\b(project|milestone|deadline)\b/i,
];

// Time estimate keywords
const TIME_ESTIMATES: Record<string, string> = {
  "1min": "1min",
  "2min": "2min",
  "3min": "5min",
  "5min": "5min",
  "quick": "5min",
  "brief": "5min",
  "short": "5min",
  "simple": "5min",
  "long": "30min",
  "detailed": "1hr",
  "complex": "2hr+",
};

/**
 * Detect if an item is a quick win based on content patterns
 */
export function detectQuickWin(item: Item): QuickWinResult {
  const text = `${item.subject || ""} ${item.bodyPreview || ""}`.toLowerCase();

  // Check for patterns that indicate NOT a quick win
  for (const pattern of NOT_QUICK_WIN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isQuickWin: false,
        reason: null,
        estimatedTime: estimateTime(text),
      };
    }
  }

  // Check for quick win patterns
  for (const { pattern, reason, time } of QUICK_WIN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isQuickWin: true,
        reason,
        estimatedTime: time,
      };
    }
  }

  // Check body length - very short messages are often quick wins
  const bodyLength = (item.bodyPreview || "").length;
  if (bodyLength < 100) {
    return {
      isQuickWin: true,
      reason: "Short message - likely quick response",
      estimatedTime: "3min",
    };
  }

  // Default: not a quick win
  return {
    isQuickWin: false,
    reason: null,
    estimatedTime: estimateTime(text),
  };
}

/**
 * Estimate time based on content keywords
 */
function estimateTime(text: string): string {
  for (const [keyword, time] of Object.entries(TIME_ESTIMATES)) {
    if (text.includes(keyword)) {
      return time;
    }
  }

  // Default based on length
  if (text.length < 200) return "5min";
  if (text.length < 500) return "15min";
  if (text.length < 1000) return "30min";
  return "1hr";
}

/**
 * Get quick win suggestions for a batch of items
 */
export function getQuickWinSuggestions(
  items: Array<{ item: Item; category: string; priority: string }>
): Array<{ item: Item; reason: string }> {
  return items
    .filter((i) => i.category === "Action-Required")
    .map((i) => {
      const result = detectQuickWin(i.item);
      return { item: i.item, ...result };
    })
    .filter((i) => i.isQuickWin)
    .sort((a, b) => {
      // Sort by estimated time (shortest first)
      const timeOrder = ["1min", "2min", "3min", "5min"];
      return (
        timeOrder.indexOf(a.estimatedTime) - timeOrder.indexOf(b.estimatedTime)
      );
    })
    .map((i) => ({ item: i.item, reason: i.reason! }));
}
