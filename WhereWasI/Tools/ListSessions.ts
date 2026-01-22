#!/usr/bin/env bun
/**
 * ListSessions.ts - List recent work sessions for WhereWasI skill
 *
 * Reads from Claude projects/ JSONL transcripts as primary data source,
 * which contains the full conversation context including user messages,
 * tool use, and files modified.
 *
 * Usage:
 *   bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts [options]
 *
 * Options:
 *   --zone <work|home|all>  Filter by zone (default: auto-detect from cwd)
 *   --days <n>              Show sessions from last n days (default: 7)
 *   --format <json|table>   Output format (default: json)
 *   --detail <session_id>   Show full details for a specific session
 *   --verbose, -v           Include more context in output
 *   --help                  Show this help
 *
 * @author PAI System
 * @version 2.0.0
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

interface JsonlEntry {
  type?: string;
  userType?: string;
  message?: {
    role?: string;
    content?: string | any[];
  };
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  uuid?: string;
  toolUseResult?: {
    success?: boolean;
  };
}

interface SessionInfo {
  id: string;
  title: string;
  userIntent: string;
  created_at: string;
  updated_at: string;
  zone: 'WORK' | 'HOME' | 'UNKNOWN';
  age: string;
  projectDir: string;
  jsonlFile: string;
  messageCount: number;
  filesModified: string[];
  toolsUsed: string[];
  cwd: string;
}

type Zone = 'work' | 'home' | 'all';

interface ParsedArgs {
  zone: Zone;
  days: number;
  format: 'json' | 'table';
  help: boolean;
  verbose: boolean;
  detail?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let zone: Zone = 'all';
  let days = 7;
  let format: 'json' | 'table' = 'json';
  let help = false;
  let verbose = false;
  let detail: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--zone':
        zone = (args[++i] || 'all').toLowerCase() as Zone;
        break;
      case '--days':
        days = parseInt(args[++i] || '7', 10);
        break;
      case '--format':
        format = (args[++i] || 'json') as 'json' | 'table';
        break;
      case '--verbose':
      case '-v':
        verbose = true;
        break;
      case '--detail':
        detail = args[++i];
        break;
      case '--help':
      case '-h':
        help = true;
        break;
    }
  }

  // Auto-detect zone from cwd if not explicitly set
  if (zone === 'all' && !args.includes('--zone')) {
    const cwd = process.cwd();
    if (cwd.startsWith('/data/work')) {
      zone = 'work';
    } else if (cwd.startsWith('/data/home')) {
      zone = 'home';
    }
  }

  return { zone, days, format, help, verbose, detail };
}

function showHelp(): void {
  console.log(`
${colors.bold}ListSessions${colors.reset} - List recent work sessions for WhereWasI

${colors.cyan}Usage:${colors.reset}
  bun ~/.claude/skills/WhereWasI/Tools/ListSessions.ts [options]

${colors.cyan}Options:${colors.reset}
  --zone <work|home|all>  Filter by zone (default: auto-detect from cwd)
  --days <n>              Show sessions from last n days (default: 7)
  --format <json|table>   Output format (default: json)
  --verbose, -v           Include user intent in output
  --detail <session_id>   Show full details for a specific session
  --help                  Show this help

${colors.cyan}Zone Detection:${colors.reset}
  /data/work/*  → WORK zone
  /data/home/*  → HOME zone
  Other         → ALL zones

${colors.cyan}Examples:${colors.reset}
  bun ListSessions.ts                    # Auto-detect zone, last 7 days
  bun ListSessions.ts --zone work        # Work zone only
  bun ListSessions.ts --days 3           # Last 3 days
  bun ListSessions.ts --format table     # Table output
  bun ListSessions.ts -v                 # Include user intent
  bun ListSessions.ts --detail abc123    # Show specific session details
`);
}

/**
 * Detect zone from projects/ directory name
 * Directory names are encoded paths: -data-home-repos-... = /data/home/repos/...
 */
function detectZoneFromProjectDir(dirName: string): 'WORK' | 'HOME' | 'UNKNOWN' {
  if (dirName.startsWith('-data-work')) {
    return 'WORK';
  } else if (dirName.startsWith('-data-home')) {
    return 'HOME';
  }
  return 'UNKNOWN';
}

/**
 * Decode project directory name to actual path
 */
function decodeProjectPath(dirName: string): string {
  // -data-home-repos-github-com-sethdf-curu-skills -> /data/home/repos/github.com/sethdf/curu-skills
  return dirName.replace(/^-/, '/').replace(/-/g, '/').replace(/\/com\//g, '.com/');
}

/**
 * Parse a JSONL file and extract session metadata
 */
async function parseJsonlFile(filePath: string): Promise<{
  userIntent: string;
  messageCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  cwd: string;
  filesModified: string[];
  toolsUsed: string[];
  sessionId: string;
}> {
  return new Promise((resolve, reject) => {
    const entries: JsonlEntry[] = [];
    const filesModified = new Set<string>();
    const toolsUsed = new Set<string>();
    let userIntent = '';
    let firstTimestamp = '';
    let lastTimestamp = '';
    let cwd = '';
    let sessionId = '';
    let lineCount = 0;

    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      lineCount++;
      if (!line.trim()) return;

      try {
        const entry: JsonlEntry = JSON.parse(line);

        // Capture first user message as intent
        if (!userIntent && entry.type === 'user' && entry.message?.role === 'user') {
          const content = entry.message.content;
          if (typeof content === 'string') {
            userIntent = content.substring(0, 200);
          } else if (Array.isArray(content)) {
            const textContent = content.find((c: any) => c.type === 'text');
            if (textContent?.text) {
              userIntent = textContent.text.substring(0, 200);
            }
          }
        }

        // Capture timestamps
        if (entry.timestamp) {
          if (!firstTimestamp) firstTimestamp = entry.timestamp;
          lastTimestamp = entry.timestamp;
        }

        // Capture cwd and sessionId
        if (entry.cwd && !cwd) cwd = entry.cwd;
        if (entry.sessionId && !sessionId) sessionId = entry.sessionId;

        // Extract tool use info from assistant messages
        if (entry.type === 'assistant' && entry.message?.content) {
          const content = entry.message.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'tool_use') {
                toolsUsed.add(item.name || 'unknown');

                // Track file modifications
                if (['Edit', 'Write'].includes(item.name) && item.input?.file_path) {
                  filesModified.add(item.input.file_path);
                }
              }
            }
          }
        }

        entries.push(entry);
      } catch {
        // Skip malformed lines
      }
    });

    rl.on('close', () => {
      resolve({
        userIntent: userIntent || '(no user message found)',
        messageCount: lineCount,
        firstTimestamp: firstTimestamp || new Date().toISOString(),
        lastTimestamp: lastTimestamp || firstTimestamp || new Date().toISOString(),
        cwd,
        filesModified: Array.from(filesModified),
        toolsUsed: Array.from(toolsUsed),
        sessionId,
      });
    });

    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

/**
 * Create a title from user intent
 */
function createTitle(userIntent: string): string {
  // Clean up and truncate
  let title = userIntent
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate to reasonable length
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  return title || '(untitled session)';
}

function getAgeLabel(timestamp: string): string {
  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const createdDay = created.toDateString();
  const todayDay = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDay = yesterday.toDateString();

  if (createdDay === todayDay) {
    return 'today';
  } else if (createdDay === yesterdayDay) {
    return 'yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays}d ago`;
  } else {
    return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * List all sessions from projects/ directory
 */
async function listSessions(zone: Zone, days: number): Promise<SessionInfo[]> {
  const projectsDir = join(process.env.HOME || '/home/ubuntu', '.claude/projects');

  if (!existsSync(projectsDir)) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const sessions: SessionInfo[] = [];

  try {
    const projectDirs = readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(projectsDir, projectDir);

      // Skip if not a directory
      try {
        if (!statSync(projectPath).isDirectory()) continue;
      } catch {
        continue;
      }

      // Detect zone from directory name
      const sessionZone = detectZoneFromProjectDir(projectDir);

      // Filter by zone
      if (zone !== 'all') {
        if (zone === 'work' && sessionZone !== 'WORK') continue;
        if (zone === 'home' && sessionZone !== 'HOME') continue;
      }

      // Get all JSONL files in this project directory
      let jsonlFiles: string[];
      try {
        jsonlFiles = readdirSync(projectPath)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => join(projectPath, f));
      } catch {
        continue;
      }

      for (const jsonlFile of jsonlFiles) {
        try {
          const stats = statSync(jsonlFile);
          const modTime = stats.mtime;

          // Filter by date
          if (modTime < cutoffDate) continue;

          // Parse the JSONL file
          const parsed = await parseJsonlFile(jsonlFile);

          // Skip if no actual content
          if (parsed.messageCount < 2) continue;

          sessions.push({
            id: parsed.sessionId || basename(jsonlFile, '.jsonl'),
            title: createTitle(parsed.userIntent),
            userIntent: parsed.userIntent,
            created_at: parsed.firstTimestamp,
            updated_at: parsed.lastTimestamp,
            zone: sessionZone,
            age: getAgeLabel(parsed.lastTimestamp),
            projectDir,
            jsonlFile: basename(jsonlFile),
            messageCount: parsed.messageCount,
            filesModified: parsed.filesModified,
            toolsUsed: parsed.toolsUsed,
            cwd: parsed.cwd,
          });
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  } catch {
    // Return empty if projects directory unreadable
  }

  // Sort by updated_at descending (most recent first)
  sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return sessions;
}

/**
 * Get detailed info for a specific session
 */
async function getSessionDetail(sessionId: string): Promise<SessionInfo | null> {
  const projectsDir = join(process.env.HOME || '/home/ubuntu', '.claude/projects');

  if (!existsSync(projectsDir)) {
    return null;
  }

  try {
    const projectDirs = readdirSync(projectsDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(projectsDir, projectDir);

      try {
        if (!statSync(projectPath).isDirectory()) continue;
      } catch {
        continue;
      }

      // Look for matching JSONL file
      const jsonlFile = join(projectPath, `${sessionId}.jsonl`);
      if (existsSync(jsonlFile)) {
        const parsed = await parseJsonlFile(jsonlFile);
        const sessionZone = detectZoneFromProjectDir(projectDir);

        return {
          id: parsed.sessionId || sessionId,
          title: createTitle(parsed.userIntent),
          userIntent: parsed.userIntent,
          created_at: parsed.firstTimestamp,
          updated_at: parsed.lastTimestamp,
          zone: sessionZone,
          age: getAgeLabel(parsed.lastTimestamp),
          projectDir,
          jsonlFile: basename(jsonlFile),
          messageCount: parsed.messageCount,
          filesModified: parsed.filesModified,
          toolsUsed: parsed.toolsUsed,
          cwd: parsed.cwd,
        };
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

function formatTable(sessions: SessionInfo[], verbose: boolean): string {
  if (sessions.length === 0) {
    return `${colors.yellow}No sessions found matching criteria${colors.reset}`;
  }

  const lines: string[] = [];

  // Group by age
  const byAge: Record<string, SessionInfo[]> = {};
  for (const session of sessions) {
    const key = session.age === 'today' || session.age === 'yesterday' ? session.age : 'older';
    byAge[key] = byAge[key] || [];
    byAge[key].push(session);
  }

  const formatSession = (s: SessionInfo): string => {
    const time = new Date(s.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const zone = s.zone !== 'UNKNOWN' ? `${colors.cyan}[${s.zone}]${colors.reset} ` : '';
    const files = s.filesModified.length > 0 ? ` ${colors.dim}(${s.filesModified.length} files)${colors.reset}` : '';

    let line = `  ${zone}${colors.bold}${s.title}${colors.reset} ${colors.gray}(${time})${colors.reset}${files}`;

    if (verbose && s.userIntent !== s.title) {
      line += `\n    ${colors.dim}${s.userIntent.substring(0, 100)}${s.userIntent.length > 100 ? '...' : ''}${colors.reset}`;
    }

    return line;
  };

  if (byAge.today?.length) {
    lines.push(`\n${colors.bold}${colors.green}Today${colors.reset}`);
    for (const s of byAge.today) {
      lines.push(formatSession(s));
    }
  }

  if (byAge.yesterday?.length) {
    lines.push(`\n${colors.bold}${colors.blue}Yesterday${colors.reset}`);
    for (const s of byAge.yesterday) {
      lines.push(formatSession(s));
    }
  }

  if (byAge.older?.length) {
    lines.push(`\n${colors.bold}${colors.magenta}Older${colors.reset}`);
    for (const s of byAge.older) {
      const date = new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const zone = s.zone !== 'UNKNOWN' ? `${colors.cyan}[${s.zone}]${colors.reset} ` : '';
      const files = s.filesModified.length > 0 ? ` ${colors.dim}(${s.filesModified.length} files)${colors.reset}` : '';
      lines.push(`  ${zone}${colors.bold}${s.title}${colors.reset} ${colors.gray}(${date})${colors.reset}${files}`);
    }
  }

  return lines.join('\n');
}

function formatSessionDetail(session: SessionInfo): string {
  const lines: string[] = [];

  lines.push(`\n${colors.bold}${colors.cyan}═══ Session Detail ═══${colors.reset}\n`);
  lines.push(`${colors.bold}Title:${colors.reset} ${session.title}`);
  lines.push(`${colors.bold}Session ID:${colors.reset} ${session.id}`);
  lines.push(`${colors.bold}Zone:${colors.reset} ${session.zone}`);
  lines.push(`${colors.bold}Working Directory:${colors.reset} ${session.cwd}`);
  lines.push(`${colors.bold}Started:${colors.reset} ${new Date(session.created_at).toLocaleString()}`);
  lines.push(`${colors.bold}Last Activity:${colors.reset} ${new Date(session.updated_at).toLocaleString()}`);
  lines.push(`${colors.bold}Messages:${colors.reset} ${session.messageCount}`);

  lines.push(`\n${colors.bold}${colors.green}User Intent:${colors.reset}`);
  lines.push(`  ${session.userIntent}`);

  if (session.toolsUsed.length > 0) {
    lines.push(`\n${colors.bold}${colors.blue}Tools Used:${colors.reset}`);
    for (const tool of session.toolsUsed) {
      lines.push(`  • ${tool}`);
    }
  }

  if (session.filesModified.length > 0) {
    lines.push(`\n${colors.bold}${colors.magenta}Files Modified:${colors.reset}`);
    for (const file of session.filesModified) {
      lines.push(`  • ${file}`);
    }
  }

  lines.push(`\n${colors.bold}Source:${colors.reset} ~/.claude/projects/${session.projectDir}/${session.jsonlFile}`);

  return lines.join('\n');
}

async function main() {
  const { zone, days, format, help, verbose, detail } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  // Handle --detail flag
  if (detail) {
    const session = await getSessionDetail(detail);
    if (!session) {
      console.error(`${colors.yellow}Session not found: ${detail}${colors.reset}`);
      process.exit(1);
    }
    if (format === 'table') {
      console.log(formatSessionDetail(session));
    } else {
      console.log(JSON.stringify(session, null, 2));
    }
    return;
  }

  const sessions = await listSessions(zone, days);

  if (format === 'table') {
    console.log(formatTable(sessions, verbose));
    if (sessions.length > 0) {
      console.log(`\n${colors.dim}Use --detail <session_id> to see full session context${colors.reset}`);
    }
  } else {
    console.log(JSON.stringify(sessions, null, 2));
  }
}

main().catch(console.error);
