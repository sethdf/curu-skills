---
name: ContextPatterns
description: Context-aware skill patterns. USE WHEN creating context-aware skills OR adding hooks OR environment detection. Reference for CreateSkill.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/ContextPatterns/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# ContextPatterns

Patterns and templates for building context-aware skills that respond to environment, directory, or session state.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **AddContextAwareness** | "make skill context-aware" | `Workflows/AddContextAwareness.md` |

## Context Detection Methods

### 1. Environment Variable Detection

Use the `CONTEXT` environment variable set by direnv:

```typescript
// TypeScript
const context = process.env.ZONE; // "work" | "home" | undefined

if (context === "work") {
  // Work-specific behavior
} else if (context === "home") {
  // Home-specific behavior
}
```

```bash
# Bash
if [[ "$ZONE" == "work" ]]; then
  # Work-specific behavior
fi
```

```markdown
<!-- In SKILL.md instructions -->
## Context Behavior
- When ZONE=work: Use formal tone, Outlook, SDP
- When ZONE=home: Use casual tone, Gmail, Telegram
```

### 2. Directory-Based Detection

Check current working directory for context clues:

```typescript
const cwd = process.cwd();
const homeDir = os.homedir();

// Check context directories
if (cwd.startsWith(path.join(homeDir, "work"))) {
  // In work context
} else if (cwd.startsWith(path.join(homeDir, "home"))) {
  // In home context
}

// Check for specific patterns
if (cwd.includes("/tickets/SDP-")) {
  // In a ticket directory
}
```

### 3. File-Based Detection

Look for marker files that indicate context:

```typescript
function findContextFile(dir: string, filename: string): string | null {
  let current = dir;
  const root = path.parse(current).root;

  while (current !== root) {
    const filePath = path.join(current, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    current = path.dirname(current);
  }
  return null;
}

// Usage
const ticketFile = findContextFile(cwd, ".ticket.json");
const projectFile = findContextFile(cwd, ".project.json");
```

## SessionStart Hooks

Hooks that run when a Claude session starts, injecting context automatically.

### Hook Interface

```typescript
interface HookInput {
  session_id: string;
  cwd: string;
}

interface HookOutput {
  continue: boolean;  // Always true unless blocking session
  context?: string;   // Markdown to inject into session
}

export async function onSessionStart(input: HookInput): Promise<HookOutput> {
  // Your logic here
  return {
    continue: true,
    context: "## Injected Context\n..."
  };
}
```

### Hook Template

```typescript
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface HookInput {
  session_id: string;
  cwd: string;
}

interface HookOutput {
  continue: boolean;
  context?: string;
}

const CONTEXT_DIR = path.join(os.homedir(), "work", "mycontext");

function isRelevantDirectory(cwd: string): boolean {
  return cwd.startsWith(CONTEXT_DIR);
}

function loadContextData(cwd: string): any | null {
  const contextFile = path.join(cwd, ".context.json");
  if (fs.existsSync(contextFile)) {
    return JSON.parse(fs.readFileSync(contextFile, "utf-8"));
  }
  return null;
}

function generateContext(data: any): string {
  return `
## Active Context

**Type**: ${data.type}
**Name**: ${data.name}

### Details
${data.description || "No description"}

### Available Commands
- "command one" - Does something
- "command two" - Does something else
`;
}

export async function onSessionStart(input: HookInput): Promise<HookOutput> {
  const { cwd } = input;

  if (!isRelevantDirectory(cwd)) {
    return { continue: true };
  }

  const data = loadContextData(cwd);
  if (!data) {
    return { continue: true };
  }

  return {
    continue: true,
    context: generateContext(data),
  };
}
```

## .envrc Integration

Skills can rely on direnv-managed environment variables:

### Standard Context Variables

| Variable | Set By | Values | Purpose |
|----------|--------|--------|---------|
| `ZONE` | `.envrc` | `work`, `home` | Primary zone indicator |
| `GHQ_ROOT` | `.envrc` | Path | Repository root for context |
| `SDP_TICKETS_DIR` | `.envrc` | Path | Ticket workspace location |

### Creating Context Directories

```bash
# In imladris-init.sh or setup script
mkdir -p /data/work /data/home

# Work .envrc
cat > /data/work/.envrc << 'EOF'
export ZONE="work"
export GHQ_ROOT="$PWD/repos"
export SDP_TICKETS_DIR="$PWD/tickets"
EOF

# Home .envrc
cat > /data/home/.envrc << 'EOF'
export ZONE="home"
export GHQ_ROOT="$PWD/repos"
EOF

# Allow direnv
direnv allow /data/work
direnv allow /data/home
```

### Adding Custom Context Variables

```bash
# In /data/work/.envrc
export ZONE="work"
export MY_SKILL_CONFIG="/data/work/.myskill.json"
export MY_SKILL_MODE="professional"
```

## Skill Structure for Context-Awareness

```
MyContextSkill/
├── SKILL.md                    # Main skill file
├── Tools/
│   └── MyTool.ts              # CLI tools
├── Workflows/
│   └── MainWorkflow.md        # Workflow definitions
└── src/
    └── context-hook.ts        # SessionStart hook
```

## Examples

**Example 1: Context-aware email skill**
```
User: "Send an email to John"
→ Checks ZONE env var
→ If work: Uses Outlook, formal tone
→ If home: Uses Gmail, casual tone
```

**Example 2: Directory-triggered context**
```
User: cd ~/work/tickets/SDP-12345 && claude
→ SessionStart hook detects ticket directory
→ Loads .ticket.json metadata
→ Injects ticket context into session
→ User sees ticket details without asking
```

**Example 3: Hybrid detection**
```
User: "Start project work"
→ Skill checks ZONE env var (work)
→ Skill checks for .project.json in cwd
→ Combines environment + file context
→ Tailors response to both signals
```

## Best Practices

1. **Graceful fallback** - Always handle missing context gracefully
2. **Don't block** - Return `continue: true` even if context not found
3. **Truncate large context** - Limit injected context to ~2000 chars
4. **Use marker files** - `.context.json`, `.ticket.json`, `.project.json`
5. **Document available commands** - Include command hints in injected context
6. **Test standalone** - Add CLI test mode to hooks (`if require.main === module`)
