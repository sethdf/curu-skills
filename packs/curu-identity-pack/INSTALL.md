# Curu Identity Pack Installation

## Prerequisites

- [ ] PAI core installed (`~/.claude/` directory exists)
- [ ] Claude Code CLI available
- [ ] Bun runtime installed

## Installation Steps

### Step 1: Create skills directory (if not exists)

```bash
mkdir -p ~/.claude/skills/CORE
```

### Step 2: Copy SKILL.md to CORE skill

```bash
cp src/SKILL.md ~/.claude/skills/CORE/
```

### Step 3: Copy USER directory

```bash
cp -r src/USER ~/.claude/skills/CORE/
```

### Step 4: Copy configuration files

```bash
cp src/Contacts.md ~/.claude/skills/CORE/
cp src/CoreStack.md ~/.claude/skills/CORE/
```

### Step 5: Update settings.json with Curu identity

Ensure the following are set in `~/.claude/settings.json`:

```json
{
  "env": {
    "DA": "Curu",
    "TIME_ZONE": "America/Denver",
    "PAI_SOURCE_APP": "Curu"
  },
  "daidentity": {
    "name": "Curu",
    "fullName": "Curu - Personal AI Assistant",
    "displayName": "Curu"
  },
  "principal": {
    "name": "Seth",
    "timezone": "America/Denver"
  }
}
```

### Step 6: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Alternative: Symlink Installation

If maintaining the pack in a separate repository:

```bash
# Remove existing CORE skill
rm -rf ~/.claude/skills/CORE

# Create symlink to pack source
ln -s /path/to/curu-packs/curu-identity-pack/src ~/.claude/skills/CORE
```

## Uninstallation

```bash
rm -rf ~/.claude/skills/CORE
```

Then update `settings.json` to remove Curu-specific identity settings.
