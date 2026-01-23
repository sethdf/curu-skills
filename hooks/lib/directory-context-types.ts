/**
 * Directory Context Types
 *
 * Defines the structure for directory-based automatic behaviors.
 * Used by DirectoryContext.hook.ts at SessionStart.
 */

export type BehaviorType = "execute" | "loadSkill" | "showInfo";

export interface ExecuteBehavior {
  type: "execute";
  /** Command to execute (via Bun.spawn) */
  command: string;
  /** Human-readable label for output header */
  label: string;
  /** If true, continue even if command fails (default: true) */
  failSilently?: boolean;
  /** Command timeout in ms (default: 10000) */
  timeout?: number;
}

export interface LoadSkillBehavior {
  type: "loadSkill";
  /** Skill name (for display purposes) */
  skill: string;
  /** Absolute path to SKILL.md file */
  skillPath: string;
}

export interface ShowInfoBehavior {
  type: "showInfo";
  /** Markdown content to display */
  content: string;
}

export type Behavior = ExecuteBehavior | LoadSkillBehavior | ShowInfoBehavior;

export interface DirectoryContext {
  /** Unique identifier for this context */
  id: string;
  /** Path prefix to match (supports startsWith matching) */
  pathPrefix: string;
  /** Human-readable description */
  description?: string;
  /** List of behaviors to execute (in order) */
  behaviors: Behavior[];
  /** Optional: only activate if this env var is set */
  requireEnv?: string;
  /** Optional: only activate if this env var equals this value */
  requireEnvValue?: string;
}

export interface DirectoryContextConfig {
  /** Schema reference for IDE support */
  $schema?: string;
  /** List of directory contexts */
  contexts: DirectoryContext[];
  /** Default settings */
  defaults?: {
    commandTimeout?: number;
    failSilently?: boolean;
  };
}

export interface SessionStartPayload {
  session_id: string;
  cwd: string;
  [key: string]: unknown;
}
