/**
 * InboxRank AI Categorizer
 *
 * Uses PAI Inference.ts (Claude Code subscription) to categorize inbox items.
 * This is the ONLY AI step in the triage pipeline.
 */

import { inference } from "/home/ubuntu/.claude/skills/CORE/Tools/Inference.ts";
import type { Item } from "../../../_shared/api/types.ts";
import { detectQuickWin, type QuickWinResult } from "./quickwin.ts";
import {
  calculateScore,
  extractScoringContext,
  type ScoringResult,
} from "./scoring.ts";

export interface CategorizationResult {
  itemId: string;
  category: "Action-Required" | "FYI" | "Delegatable" | "Spam" | "Archive";
  priority: "P0" | "P1" | "P2" | "P3";
  confidence: number;
  quickWin: boolean;
  quickWinReason: string | null;
  estimatedTime: string;
  reasoning: string;
  suggestedAction: string;
  scoring: ScoringResult;
}

/**
 * Build the categorization prompt for a single item
 */
function buildPrompt(item: Item, isVip: boolean): string {
  const metadata = item.metadata || {};

  let prompt = `## Item Details
- Source: ${item.source}
- From: ${item.fromName || "Unknown"} <${item.fromAddress || "unknown"}>
- VIP: ${isVip ? "Yes" : "No"}
- Subject: ${item.subject || "(no subject)"}
- Received: ${item.timestamp}
- Type: ${item.itemType}`;

  // Add source-specific context
  if (item.source.startsWith("sdp-")) {
    prompt += `\n- Status: ${metadata.status || "unknown"}`;
    prompt += `\n- Priority: ${metadata.priority || "unknown"}`;
    if (metadata.dueDate) {
      prompt += `\n- Due Date: ${metadata.dueDate}`;
    }
  }

  if (item.source === "slack") {
    prompt += `\n- Channel: ${metadata.channelName || metadata.channelId || "unknown"}`;
    prompt += `\n- Channel Type: ${metadata.channelType || "unknown"}`;
  }

  // Add body preview
  prompt += `\n\n## Content Preview\n${item.bodyPreview || item.body?.substring(0, 500) || "(empty)"}`;

  // Add thread context
  if (item.threadContext && item.threadContext.length > 0) {
    prompt += `\n\n## Thread Context`;
    for (const msg of item.threadContext.slice(-3)) {
      prompt += `\n- ${msg.fromName}: ${msg.preview}`;
    }
  }

  return prompt;
}

// System prompt for categorization
const SYSTEM_PROMPT = `You are an inbox triage assistant. Categorize items and return ONLY valid JSON.
Categories:
- Action-Required: Needs direct action (request, assigned task, question)
- FYI: Informational only (status update, newsletter, notification)
- Delegatable: Can be handed off (request within someone else's domain)
- Spam: Unwanted or irrelevant (marketing, automated alerts)
- Archive: Completed or no longer relevant (old thread, resolved issue)

Response format:
{"category": "Action-Required|FYI|Delegatable|Spam|Archive", "confidence": 1-10, "reasoning": "Brief explanation", "suggestedAction": "What to do next"}`;

/**
 * Categorize a single item using AI
 */
export async function categorizeItem(
  item: Item,
  isVip: boolean,
  verbose: boolean = false
): Promise<CategorizationResult> {
  const userPrompt = buildPrompt(item, isVip);

  if (verbose) {
    console.error(`[categorize] Processing ${item.id}...`);
  }

  try {
    // Call PAI Inference.ts (Claude Code subscription, fast = Haiku)
    const result = await inference({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      level: "fast",
      expectJson: true,
      timeout: 15000,
    });

    if (!result.success) {
      throw new Error(result.error || "Inference failed");
    }

    const aiResult = result.parsed as {
      category?: string;
      confidence?: number;
      reasoning?: string;
      suggestedAction?: string;
    };

    if (!aiResult) {
      throw new Error("No JSON parsed from AI response");
    }

    // Validate category
    const validCategories = [
      "Action-Required",
      "FYI",
      "Delegatable",
      "Spam",
      "Archive",
    ];
    if (!validCategories.includes(aiResult.category)) {
      aiResult.category = "FYI"; // Default to FYI if invalid
    }

    // Calculate priority score
    const scoringContext = extractScoringContext(item, isVip);
    const scoring = calculateScore(aiResult.category, scoringContext);

    // Detect quick win
    const quickWinResult = detectQuickWin(item);

    return {
      itemId: item.id,
      category: aiResult.category,
      priority: scoring.priority,
      confidence: Math.min(10, Math.max(1, aiResult.confidence || 5)),
      quickWin: quickWinResult.isQuickWin && aiResult.category === "Action-Required",
      quickWinReason: quickWinResult.reason,
      estimatedTime: quickWinResult.estimatedTime,
      reasoning: aiResult.reasoning || "No reasoning provided",
      suggestedAction: aiResult.suggestedAction || "Review and respond",
      scoring,
    };
  } catch (error) {
    if (verbose) {
      console.error(`[categorize] Error for ${item.id}:`, error);
    }

    // Return a safe default on error
    const scoringContext = extractScoringContext(item, isVip);
    const scoring = calculateScore("FYI", scoringContext);
    const quickWinResult = detectQuickWin(item);

    return {
      itemId: item.id,
      category: "FYI",
      priority: scoring.priority,
      confidence: 1,
      quickWin: false,
      quickWinReason: null,
      estimatedTime: quickWinResult.estimatedTime,
      reasoning: `Error during categorization: ${error}`,
      suggestedAction: "Review manually",
      scoring,
    };
  }
}

/**
 * Categorize a batch of items
 */
export async function categorizeBatch(
  items: Item[],
  isVipFn: (item: Item) => Promise<boolean>,
  options: {
    verbose?: boolean;
    batchSize?: number;
    delayMs?: number;
  } = {}
): Promise<CategorizationResult[]> {
  const { verbose = false, batchSize = 5, delayMs = 500 } = options;
  const results: CategorizationResult[] = [];

  // Process in batches to avoid overwhelming the inference tool
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    if (verbose) {
      console.error(
        `[categorize] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}...`
      );
    }

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const isVip = await isVipFn(item);
        return categorizeItem(item, isVip, verbose);
      })
    );

    results.push(...batchResults);

    // Delay between batches to avoid rate limits
    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
