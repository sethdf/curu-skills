#!/usr/bin/env bun
// curu-skills/hooks/detect-working-directory.ts
// SessionStart hook: Detect if user is in a working directory, prompt if not

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

interface SessionStartPayload {
  session_id: string;
  cwd: string;
  [key: string]: any;
}

interface WorkingDirectoryConfig {
  directories: string[];
  projectMarkers: string[];
}

function loadConfig(): WorkingDirectoryConfig {
  const configPath = join(dirname(import.meta.path), 'working-directories.json');

  const defaults: WorkingDirectoryConfig = {
    directories: [
      '/home/ubuntu/work',
      '/data/work',
      '/data/home/repos'
    ],
    projectMarkers: ['.git', 'CLAUDE.md', '.claude', 'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml']
  };

  if (!existsSync(configPath)) {
    return defaults;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return {
      directories: config.directories || defaults.directories,
      projectMarkers: config.projectMarkers || defaults.projectMarkers
    };
  } catch {
    return defaults;
  }
}

function isInWorkingDirectory(cwd: string, config: WorkingDirectoryConfig): boolean {
  // Check if cwd is under any known working directory
  for (const dir of config.directories) {
    if (cwd.startsWith(dir)) {
      return true;
    }
  }
  return false;
}

function hasProjectMarkers(cwd: string, config: WorkingDirectoryConfig): boolean {
  // Check if cwd contains any project marker files/directories
  for (const marker of config.projectMarkers) {
    if (existsSync(join(cwd, marker))) {
      return true;
    }
  }
  return false;
}

function isSubagentSession(): boolean {
  return process.env.CLAUDE_CODE_AGENT !== undefined ||
         process.env.SUBAGENT === 'true';
}

async function main() {
  try {
    // Skip for subagents
    if (isSubagentSession()) {
      process.exit(0);
    }

    const stdinData = await Bun.stdin.text();
    if (!stdinData.trim()) {
      process.exit(0);
    }

    const payload: SessionStartPayload = JSON.parse(stdinData);
    const cwd = payload.cwd || process.cwd();
    const config = loadConfig();

    const inWorkDir = isInWorkingDirectory(cwd, config);
    const hasMarkers = hasProjectMarkers(cwd, config);

    // If in a working directory or has project markers, no action needed
    if (inWorkDir || hasMarkers) {
      process.exit(0);
    }

    // Not in a recognized project context - output prompt for Claude
    const output = `<no-project-context>
You opened Claude in a non-project directory: ${cwd}

Ask Seth what he'd like to work on. Offer options like:
- Navigate to an existing project (list recent ones if known)
- Start something new
- Just chat or research (no project needed)
- Check email, calendar, or messages

Keep it brief - just ask "What would you like to work on?" with a few quick options.
</no-project-context>`;

    console.log(output);

  } catch (error) {
    // Never crash - just skip
    console.error('[curu-skills] detect-working-directory error:', error);
  }

  process.exit(0);
}

main();
