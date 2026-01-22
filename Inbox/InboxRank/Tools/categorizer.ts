/**
 * InboxRank AI Categorizer
 *
 * Uses AWS Bedrock (Claude) to categorize inbox items.
 * This is the ONLY AI step in the triage pipeline.
 */

import { $ } from "bun";
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

// Use Claude 3.5 Haiku for fast, cheap inference
const BEDROCK_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Categories with descriptions for the prompt
const CATEGORIES = `
- Action-Required: Needs your direct action (request for decision, assigned task, question to answer)
- FYI: Informational only, no action needed (status update, newsletter, notification)
- Delegatable: Can be handed off to someone else (request within someone else's domain)
- Spam: Unwanted or irrelevant (marketing, automated alerts you don't need)
- Archive: Completed or no longer relevant (old thread, resolved issue)
`;

/**
 * Build the categorization prompt for a single item
 */
function buildPrompt(item: Item, isVip: boolean): string {
  const metadata = item.metadata || {};

  let prompt = `Categorize this inbox item. Return ONLY a JSON object.

## Item Details
- Source: ${item.source}
- From: ${item.fromName || "Unknown"} <${item.fromAddress || "unknown"}>
- VIP: ${isVip ? "Yes" : "No"}
- Subject: ${item.subject || "(no subject)"}
- Received: ${item.timestamp}
- Type: ${item.itemType}
`;

  // Add source-specific context
  if (item.source.startsWith("sdp-")) {
    prompt += `- Status: ${metadata.status || "unknown"}
- Priority: ${metadata.priority || "unknown"}
`;
    if (metadata.dueDate) {
      prompt += `- Due Date: ${metadata.dueDate}\n`;
    }
  }

  if (item.source === "slack") {
    prompt += `- Channel: ${metadata.channelName || metadata.channelId || "unknown"}
- Channel Type: ${metadata.channelType || "unknown"}
`;
  }

  // Add body preview
  prompt += `
## Content Preview
${item.bodyPreview || item.body?.substring(0, 500) || "(empty)"}

## Thread Context
`;

  if (item.threadContext && item.threadContext.length > 0) {
    for (const msg of item.threadContext.slice(-3)) {
      prompt += `- ${msg.fromName}: ${msg.preview}\n`;
    }
  } else {
    prompt += "(no thread context)\n";
  }

  prompt += `
## Categories
${CATEGORIES}

## Response Format
Return ONLY valid JSON:
{
  "category": "Action-Required|FYI|Delegatable|Spam|Archive",
  "confidence": 1-10,
  "reasoning": "Brief explanation",
  "suggestedAction": "What to do next"
}`;

  return prompt;
}

/**
 * Categorize a single item using AI
 */
export async function categorizeItem(
  item: Item,
  isVip: boolean,
  verbose: boolean = false
): Promise<CategorizationResult> {
  const prompt = buildPrompt(item, isVip);

  if (verbose) {
    console.error(`[categorize] Processing ${item.id}...`);
  }

  try {
    // Call inference tool (standard = Sonnet for balanced speed/quality)
    const result =
      await $`echo ${prompt} | bun ${INFERENCE_TOOL} standard`.text();

    // Parse JSON response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const aiResult = JSON.parse(jsonMatch[0]);

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
