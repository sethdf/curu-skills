#!/usr/bin/env bun
/**
 * DirectoryContext.hook.ts - Directory-Based Automatic Behaviors (SessionStart)
 *
 * PURPOSE:
 * Executes automatic behaviors when Claude opens in specific directories.
 * This is ADDITIVE to normal CORE loading - it adds context, not replaces it.
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - stdin: JSON payload with session_id, cwd
 * - Files: directory-contexts.json configuration
 *
 * OUTPUT:
 * - stdout: <system-reminder> with behavior results
 * - stderr: Status messages and errors
 * - exit(0): Always (graceful failure)
 *
 * BEHAVIORS SUPPORTED:
 * - execute: Run a command and show output
 * - loadSkill: Inject skill SKILL.md content
 * - showInfo: Display static information
 *
 * CRITICAL: This hook NEVER crashes. All errors are logged and skipped.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type {
  DirectoryContextConfig,
  DirectoryContext,
  ExecuteBehavior,
  LoadSkillBehavior,
  SessionStartPayload,
} from "./lib/directory-context-types";

const CONFIG_PATH = join(dirname(import.meta.path), "directory-contexts.json");

function loadConfig(): DirectoryContextConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) {
      console.error("[DirectoryContext] No config file found, skipping");
      return null;
    }
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (error) {
    console.error("[DirectoryContext] Failed to load config:", error);
    return null;
  }
}

function findMatchingContext(
  cwd: string,
  config: DirectoryContextConfig
): DirectoryContext | null {
  // Find the most specific match (longest pathPrefix that matches)
  let bestMatch: DirectoryContext | null = null;
  let bestLength = 0;

  for (const ctx of config.contexts) {
    if (cwd.startsWith(ctx.pathPrefix)) {
      // Check environment requirements
      if (ctx.requireEnv) {
        const envValue = process.env[ctx.requireEnv];
        if (!envValue) continue;
        if (ctx.requireEnvValue && envValue !== ctx.requireEnvValue) continue;
      }

      if (ctx.pathPrefix.length > bestLength) {
        bestMatch = ctx;
        bestLength = ctx.pathPrefix.length;
      }
    }
  }

  return bestMatch;
}

async function executeCommand(
  behavior: ExecuteBehavior,
  defaults: DirectoryContextConfig["defaults"]
): Promise<string> {
  const timeout = behavior.timeout ?? defaults?.commandTimeout ?? 10000;
  const failSilently = behavior.failSilently ?? defaults?.failSilently ?? true;

  try {
    const proc = Bun.spawn(["bash", "-c", behavior.command], {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });

    // Implement timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Command timed out")), timeout);
    });

    const outputPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      if (proc.exitCode !== 0 && !failSilently) {
        throw new Error(
          `Command failed with exit code ${proc.exitCode}: ${stderr}`
        );
      }

      return stdout.trim() || stderr.trim() || "(no output)";
    })();

    return await Promise.race([outputPromise, timeoutPromise]);
  } catch (error) {
    if (failSilently) {
      return `(command failed: ${error instanceof Error ? error.message : "unknown error"})`;
    }
    throw error;
  }
}

function loadSkillContent(behavior: LoadSkillBehavior): string {
  try {
    if (!existsSync(behavior.skillPath)) {
      return `(skill not found: ${behavior.skillPath})`;
    }
    return readFileSync(behavior.skillPath, "utf-8");
  } catch (error) {
    return `(failed to load skill: ${error instanceof Error ? error.message : "unknown"})`;
  }
}

async function processBehaviors(
  context: DirectoryContext,
  defaults: DirectoryContextConfig["defaults"]
): Promise<string[]> {
  const results: string[] = [];

  for (const behavior of context.behaviors) {
    try {
      switch (behavior.type) {
        case "execute": {
          const output = await executeCommand(behavior, defaults);
          results.push(`### ${behavior.label}\n\n\`\`\`\n${output}\n\`\`\``);
          break;
        }
        case "loadSkill": {
          const content = loadSkillContent(behavior);
          results.push(`### Skill: ${behavior.skill}\n\n${content}`);
          break;
        }
        case "showInfo": {
          results.push(behavior.content);
          break;
        }
      }
    } catch (error) {
      console.error(`[DirectoryContext] Behavior failed:`, error);
      // Continue with other behaviors
    }
  }

  return results;
}

function isSubagentSession(): boolean {
  return (
    process.env.CLAUDE_CODE_AGENT !== undefined ||
    process.env.SUBAGENT === "true" ||
    (process.env.CLAUDE_PROJECT_DIR || "").includes("/.claude/Agents/")
  );
}

async function main() {
  try {
    // Skip for subagents
    if (isSubagentSession()) {
      process.exit(0);
    }

    // Read payload from stdin
    const stdinData = await Bun.stdin.text();
    if (!stdinData.trim()) {
      console.error("[DirectoryContext] No stdin payload");
      process.exit(0);
    }

    const payload: SessionStartPayload = JSON.parse(stdinData);
    const cwd = payload.cwd || process.cwd();

    // Load configuration
    const config = loadConfig();
    if (!config) {
      process.exit(0);
    }

    // Find matching context
    const context = findMatchingContext(cwd, config);
    if (!context) {
      // No match is normal - just exit silently
      process.exit(0);
    }

    console.error(
      `[DirectoryContext] Matched context: ${context.id} (${context.description || "no description"})`
    );

    // Process behaviors
    const results = await processBehaviors(context, config.defaults);

    if (results.length === 0) {
      process.exit(0);
    }

    // Output as system-reminder (ADDITIVE to CORE)
    const output = `<system-reminder>
## Directory Context: ${context.description || context.id}

**Working Directory:** \`${cwd}\`
**Context ID:** ${context.id}

${results.join("\n\n---\n\n")}

---
*This context was automatically loaded based on your working directory. It is ADDITIVE to normal CORE context.*
</system-reminder>`;

    console.log(output);
    process.exit(0);
  } catch (error) {
    // NEVER crash - graceful exit
    console.error("[DirectoryContext] Error:", error);
    process.exit(0);
  }
}

main();
