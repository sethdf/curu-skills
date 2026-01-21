#!/usr/bin/env bun
/**
 * ListSessions.ts - List recent work sessions for resume
 *
 * Usage:
 *   bun ~/.claude/skills/Resume/Tools/ListSessions.ts [options]
 *
 * Options:
 *   --zone <work|home|all>  Filter by zone (default: auto-detect from cwd)
 *   --days <n>              Show sessions from last n days (default: 7)
 *   --format <json|table>   Output format (default: json)
 *   --help                  Show this help
 *
 * @author PAI System
 * @version 1.0.0
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';

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
};

interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  completed_at?: string;
  status: string;
  session_id?: string;
  lineage?: {
    tools_used: string[];
    files_changed: string[];
    agents_spawned: string[];
  };
}

interface SessionItem {
  id: string;
  description: string;
  type: string;
  status: string;
  response_summary?: string;
}

interface SessionInfo {
  id: string;
  title: string;
  created_at: string;
  completed_at?: string;
  status: string;
  zone: 'WORK' | 'HOME' | 'UNKNOWN';
  age: string;
  relativePath: string;
  summary?: string;
  items?: SessionItem[];
  files_changed?: string[];
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
${colors.bold}ListSessions${colors.reset} - List recent work sessions for resume

${colors.cyan}Usage:${colors.reset}
  bun ~/.claude/skills/Resume/Tools/ListSessions.ts [options]

${colors.cyan}Options:${colors.reset}
  --zone <work|home|all>  Filter by zone (default: auto-detect from cwd)
  --days <n>              Show sessions from last n days (default: 7)
  --format <json|table>   Output format (default: json)
  --verbose, -v           Include item summaries in output
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
  bun ListSessions.ts -v                 # Include item summaries
  bun ListSessions.ts --detail 20260121-060549_what-were-we-working-on
`);
}

function loadSessionItems(workDir: string, sessionPath: string): SessionItem[] {
  const itemsDir = join(workDir, sessionPath, 'items');
  const items: SessionItem[] = [];

  if (!existsSync(itemsDir)) {
    return items;
  }

  try {
    const files = readdirSync(itemsDir).filter(f => f.endsWith('.yaml'));
    for (const file of files) {
      try {
        const content = readFileSync(join(itemsDir, file), 'utf-8');
        const item = parseYaml(content);
        items.push({
          id: item.id || file.replace('.yaml', ''),
          description: item.description || '',
          type: item.type || 'unknown',
          status: item.status || 'unknown',
          response_summary: item.response_summary,
        });
      } catch {
        // Skip malformed items
      }
    }
  } catch {
    // Ignore errors
  }

  return items;
}

function getSessionDetail(sessionIdOrPath: string): SessionInfo | null {
  const workDir = join(process.env.HOME || '/home/ubuntu', '.claude/MEMORY/WORK');

  // Find matching session
  const dirs = existsSync(workDir) ? readdirSync(workDir) : [];
  const matchingDir = dirs.find(d => d === sessionIdOrPath || d.includes(sessionIdOrPath));

  if (!matchingDir) {
    return null;
  }

  const metaPath = join(workDir, matchingDir, 'META.yaml');
  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const metaContent = readFileSync(metaPath, 'utf-8');
    const meta: SessionMeta = parseYaml(metaContent);
    const createdAt = meta.created_at || extractTimestampFromDir(matchingDir);
    const sessionZone = detectZoneFromSessionId(meta.session_id || '');
    const items = loadSessionItems(workDir, matchingDir);

    return {
      id: meta.id || matchingDir,
      title: meta.title || extractTitleFromDir(matchingDir),
      created_at: createdAt,
      completed_at: meta.completed_at,
      status: meta.status || 'UNKNOWN',
      zone: sessionZone,
      age: getAgeLabel(createdAt),
      relativePath: matchingDir,
      items,
      files_changed: meta.lineage?.files_changed || [],
      summary: items.map(i => i.response_summary).filter(Boolean).join(' '),
    };
  } catch {
    return null;
  }
}

function formatSessionDetail(session: SessionInfo): string {
  const lines: string[] = [];

  lines.push(`\n${colors.bold}${colors.cyan}═══ Session Detail ═══${colors.reset}\n`);
  lines.push(`${colors.bold}Title:${colors.reset} ${session.title}`);
  lines.push(`${colors.bold}ID:${colors.reset} ${session.id}`);
  lines.push(`${colors.bold}Zone:${colors.reset} ${session.zone}`);
  lines.push(`${colors.bold}Status:${colors.reset} ${session.status}`);
  lines.push(`${colors.bold}Created:${colors.reset} ${new Date(session.created_at).toLocaleString()}`);
  if (session.completed_at) {
    lines.push(`${colors.bold}Completed:${colors.reset} ${new Date(session.completed_at).toLocaleString()}`);
  }

  if (session.items?.length) {
    lines.push(`\n${colors.bold}${colors.green}Work Items:${colors.reset}`);
    for (const item of session.items) {
      const status = item.status === 'DONE' ? `${colors.dim}✓${colors.reset}` : `${colors.yellow}◎${colors.reset}`;
      lines.push(`  ${status} ${colors.bold}${item.description}${colors.reset} ${colors.gray}(${item.type})${colors.reset}`);
      if (item.response_summary) {
        // Truncate long summaries
        const summary = item.response_summary.length > 100
          ? item.response_summary.substring(0, 100) + '...'
          : item.response_summary;
        lines.push(`    ${colors.dim}${summary}${colors.reset}`);
      }
    }
  }

  if (session.files_changed?.length) {
    lines.push(`\n${colors.bold}${colors.blue}Files Changed:${colors.reset}`);
    for (const file of session.files_changed) {
      lines.push(`  • ${file}`);
    }
  }

  lines.push(`\n${colors.bold}Path:${colors.reset} ~/.claude/MEMORY/WORK/${session.relativePath}/`);

  return lines.join('\n');
}

function detectZoneFromPath(workDirName: string): 'WORK' | 'HOME' | 'UNKNOWN' {
  // WORK/ directory names are timestamps + slugs, we need to check the projects/ mapping
  // For now, we can infer from session metadata or default to UNKNOWN
  // A more sophisticated approach would cross-reference with projects/ directory
  return 'UNKNOWN';
}

function detectZoneFromSessionId(sessionId: string): 'WORK' | 'HOME' | 'UNKNOWN' {
  // Try to find which projects/ directory contains this session
  const projectsDir = join(process.env.HOME || '/home/ubuntu', '.claude/projects');

  if (!existsSync(projectsDir)) {
    return 'UNKNOWN';
  }

  try {
    const projectDirs = readdirSync(projectsDir);
    for (const dir of projectDirs) {
      const sessionFile = join(projectsDir, dir, `${sessionId}.jsonl`);
      if (existsSync(sessionFile)) {
        if (dir.includes('-data-work')) {
          return 'WORK';
        } else if (dir.includes('-data-home')) {
          return 'HOME';
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return 'UNKNOWN';
}

function getAgeLabel(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Check if same calendar day
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

function listSessions(zone: Zone, days: number): SessionInfo[] {
  const workDir = join(process.env.HOME || '/home/ubuntu', '.claude/MEMORY/WORK');

  if (!existsSync(workDir)) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const sessions: SessionInfo[] = [];

  try {
    const dirs = readdirSync(workDir);

    for (const dir of dirs) {
      const metaPath = join(workDir, dir, 'META.yaml');

      if (!existsSync(metaPath)) {
        continue;
      }

      try {
        const metaContent = readFileSync(metaPath, 'utf-8');
        const meta: SessionMeta = parseYaml(metaContent);

        // Parse timestamp from directory name
        const createdAt = meta.created_at || extractTimestampFromDir(dir);
        const createdDate = new Date(createdAt);

        // Filter by date
        if (createdDate < cutoffDate) {
          continue;
        }

        // Detect zone from session_id if available
        let sessionZone = detectZoneFromSessionId(meta.session_id || '');

        // If still unknown, try to infer from directory pattern or default
        if (sessionZone === 'UNKNOWN') {
          sessionZone = detectZoneFromPath(dir);
        }

        // Filter by zone
        if (zone !== 'all') {
          if (zone === 'work' && sessionZone !== 'WORK' && sessionZone !== 'UNKNOWN') {
            continue;
          }
          if (zone === 'home' && sessionZone !== 'HOME' && sessionZone !== 'UNKNOWN') {
            continue;
          }
        }

        sessions.push({
          id: meta.id || dir,
          title: meta.title || extractTitleFromDir(dir),
          created_at: createdAt,
          completed_at: meta.completed_at,
          status: meta.status || 'UNKNOWN',
          zone: sessionZone,
          age: getAgeLabel(createdAt),
          relativePath: dir,
        });
      } catch {
        // Skip malformed entries
      }
    }
  } catch {
    // Return empty if WORK directory unreadable
  }

  // Sort by created_at descending (most recent first)
  sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return sessions;
}

function extractTimestampFromDir(dir: string): string {
  // Directory format: YYYYMMDD-HHMMSS_slug
  const match = dir.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }
  return new Date().toISOString();
}

function extractTitleFromDir(dir: string): string {
  // Directory format: YYYYMMDD-HHMMSS_slug
  const match = dir.match(/^\d{8}-\d{6}_(.+)$/);
  if (match) {
    return match[1].replace(/-/g, ' ');
  }
  return dir;
}

function formatTable(sessions: SessionInfo[]): string {
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

  // Output groups
  if (byAge.today?.length) {
    lines.push(`\n${colors.bold}${colors.green}Today${colors.reset}`);
    for (const s of byAge.today) {
      const time = new Date(s.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const status = s.status === 'COMPLETED' ? `${colors.dim}✓${colors.reset}` : `${colors.yellow}◎${colors.reset}`;
      const zone = s.zone !== 'UNKNOWN' ? `${colors.cyan}[${s.zone}]${colors.reset} ` : '';
      lines.push(`  ${status} ${zone}${colors.bold}${s.title}${colors.reset} ${colors.gray}(${time})${colors.reset}`);
    }
  }

  if (byAge.yesterday?.length) {
    lines.push(`\n${colors.bold}${colors.blue}Yesterday${colors.reset}`);
    for (const s of byAge.yesterday) {
      const time = new Date(s.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const status = s.status === 'COMPLETED' ? `${colors.dim}✓${colors.reset}` : `${colors.yellow}◎${colors.reset}`;
      const zone = s.zone !== 'UNKNOWN' ? `${colors.cyan}[${s.zone}]${colors.reset} ` : '';
      lines.push(`  ${status} ${zone}${colors.bold}${s.title}${colors.reset} ${colors.gray}(${time})${colors.reset}`);
    }
  }

  if (byAge.older?.length) {
    lines.push(`\n${colors.bold}${colors.magenta}Older${colors.reset}`);
    for (const s of byAge.older) {
      const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const status = s.status === 'COMPLETED' ? `${colors.dim}✓${colors.reset}` : `${colors.yellow}◎${colors.reset}`;
      const zone = s.zone !== 'UNKNOWN' ? `${colors.cyan}[${s.zone}]${colors.reset} ` : '';
      lines.push(`  ${status} ${zone}${colors.bold}${s.title}${colors.reset} ${colors.gray}(${date})${colors.reset}`);
    }
  }

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
    const session = getSessionDetail(detail);
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

  const sessions = listSessions(zone, days);

  // Enrich with items if verbose
  if (verbose) {
    const workDir = join(process.env.HOME || '/home/ubuntu', '.claude/MEMORY/WORK');
    for (const session of sessions) {
      const items = loadSessionItems(workDir, session.relativePath);
      session.items = items;
      session.summary = items.map(i => i.response_summary).filter(Boolean).join(' ').substring(0, 200);
    }
  }

  if (format === 'table') {
    console.log(formatTable(sessions));
    if (verbose && sessions.length > 0) {
      console.log(`\n${colors.dim}Use --detail <session_id> to see full session context${colors.reset}`);
    }
  } else {
    console.log(JSON.stringify(sessions, null, 2));
  }
}

main().catch(console.error);
