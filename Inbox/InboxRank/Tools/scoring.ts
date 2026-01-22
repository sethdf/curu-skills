/**
 * InboxRank Scoring Model
 *
 * Priority scoring based on category, modifiers, and context.
 * This is deterministic logic - no AI here.
 */

import type { Item } from "../../../_shared/api/types.ts";

export interface ScoringContext {
  isVip: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isHighPrioritySource: boolean;
  hasAttachment: boolean;
  isThreadReply: boolean;
  isSlackDm: boolean;
  ageHours: number;
}

export interface ScoringResult {
  baseScore: number;
  modifiers: { name: string; value: number }[];
  totalScore: number;
  priority: "P0" | "P1" | "P2" | "P3";
}

// Base scores by category
const BASE_SCORES: Record<string, number> = {
  "Action-Required": 60,
  "Delegatable": 40,
  "FYI": 20,
  "Spam": 0,
  "Archive": 0,
};

/**
 * Calculate priority score based on category and context modifiers
 */
export function calculateScore(
  category: string,
  context: ScoringContext
): ScoringResult {
  const baseScore = BASE_SCORES[category] ?? 20;
  const modifiers: { name: string; value: number }[] = [];

  // VIP sender: +30
  if (context.isVip) {
    modifiers.push({ name: "VIP sender", value: 30 });
  }

  // Overdue: +25
  if (context.isOverdue) {
    modifiers.push({ name: "Overdue", value: 25 });
  }

  // Due today: +15
  if (context.isDueToday && !context.isOverdue) {
    modifiers.push({ name: "Due today", value: 15 });
  }

  // High priority from source: +20
  if (context.isHighPrioritySource) {
    modifiers.push({ name: "High priority (source)", value: 20 });
  }

  // Has attachment: +5
  if (context.hasAttachment) {
    modifiers.push({ name: "Has attachment", value: 5 });
  }

  // Thread reply: +10
  if (context.isThreadReply) {
    modifiers.push({ name: "Thread reply", value: 10 });
  }

  // Slack DM: +10
  if (context.isSlackDm) {
    modifiers.push({ name: "Slack DM", value: 10 });
  }

  // Old unread item (> 48 hours): +5
  if (context.ageHours > 48) {
    modifiers.push({ name: "Old item", value: 5 });
  }

  const modifierTotal = modifiers.reduce((sum, m) => sum + m.value, 0);
  const totalScore = baseScore + modifierTotal;

  // Map score to priority
  let priority: "P0" | "P1" | "P2" | "P3";
  if (totalScore >= 80) {
    priority = "P0";
  } else if (totalScore >= 60) {
    priority = "P1";
  } else if (totalScore >= 40) {
    priority = "P2";
  } else {
    priority = "P3";
  }

  return {
    baseScore,
    modifiers,
    totalScore,
    priority,
  };
}

/**
 * Extract scoring context from an item and its metadata
 */
export function extractScoringContext(
  item: Item,
  isVip: boolean
): ScoringContext {
  const metadata = item.metadata || {};
  const now = new Date();
  const itemTime = new Date(item.timestamp);
  const ageHours = (now.getTime() - itemTime.getTime()) / (1000 * 60 * 60);

  // Check for due dates in metadata
  let isOverdue = false;
  let isDueToday = false;
  if (metadata.dueDate) {
    const dueDate = new Date(metadata.dueDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    isOverdue = dueDate < todayStart;
    isDueToday = !isOverdue && dueDate <= today;
  }

  // Check for high priority indicators
  const isHighPrioritySource =
    metadata.priority === "high" ||
    metadata.priority === "urgent" ||
    metadata.importance === "high" ||
    metadata.urgency?.toLowerCase() === "high";

  // Check for attachments
  const hasAttachment =
    metadata.hasAttachments === true ||
    (Array.isArray(metadata.attachments) && metadata.attachments.length > 0);

  // Check for thread context
  const isThreadReply =
    !!item.threadId ||
    (item.threadContext && item.threadContext.length > 0);

  // Check for Slack DM
  const isSlackDm =
    item.source === "slack" &&
    (metadata.channelType === "im" || metadata.isDm === true);

  return {
    isVip,
    isOverdue,
    isDueToday,
    isHighPrioritySource,
    hasAttachment,
    isThreadReply,
    isSlackDm,
    ageHours,
  };
}

/**
 * Get human-readable priority description
 */
export function getPriorityDescription(priority: string): string {
  switch (priority) {
    case "P0":
      return "Critical/Urgent - Immediate (< 1 hour)";
    case "P1":
      return "High priority - Today";
    case "P2":
      return "Normal - This week";
    case "P3":
      return "Low priority - When convenient";
    default:
      return "Unknown priority";
  }
}
