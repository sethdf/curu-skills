# AddContextAwareness Workflow

Add context-awareness to an existing skill.

## Steps

### 1. Identify Context Type

Determine which context detection method fits:

| If skill needs to... | Use |
|---------------------|-----|
| Behave differently in work vs home | Environment variable (`CONTEXT`) |
| Auto-load data from current directory | Directory detection + marker file |
| Inject context at session start | SessionStart hook |
| All of the above | Combine methods |

### 2. Add Environment Detection

In your skill's tools or SKILL.md:

```typescript
// In Tools/MyTool.ts
const context = process.env.CONTEXT || "default";
```

```markdown
<!-- In SKILL.md -->
## Context Behavior
Check `CONTEXT` environment variable:
- `work`: [work-specific instructions]
- `home`: [home-specific instructions]
```

### 3. Add Directory Detection (Optional)

If skill should respond to specific directories:

```typescript
// In src/context-hook.ts or Tools/
const SKILL_DIR = path.join(os.homedir(), "work", "myskill");

function isSkillDirectory(cwd: string): boolean {
  return cwd.startsWith(SKILL_DIR);
}
```

### 4. Create SessionStart Hook (Optional)

If skill should inject context automatically:

1. Create `src/context-hook.ts` using template from SKILL.md
2. Export `onSessionStart` function
3. Add CLI test mode for debugging

### 5. Define Marker File Schema (Optional)

If using file-based detection, document the schema:

```json
// .mycontext.json
{
  "type": "myskill",
  "name": "Context Name",
  "description": "What this context represents",
  "metadata": {}
}
```

### 6. Update SKILL.md

Add context documentation:

```markdown
## Context Awareness

This skill is context-aware:

### Environment
- Checks `CONTEXT` env var for work/home mode

### Directory Detection
- Activates when in `~/work/myskill/` directories
- Looks for `.mycontext.json` marker file

### Auto-Injected Context
- On SessionStart, loads context from marker file
- Injects relevant details into session
```

### 7. Test

```bash
# Test environment detection
CONTEXT=work bun run Tools/MyTool.ts

# Test hook
cd ~/work/myskill/test-context
bun run src/context-hook.ts
```

## Checklist

- [ ] Identified context detection method(s)
- [ ] Added environment variable check if needed
- [ ] Added directory detection if needed
- [ ] Created SessionStart hook if needed
- [ ] Defined marker file schema if needed
- [ ] Updated SKILL.md with context documentation
- [ ] Tested in both contexts
