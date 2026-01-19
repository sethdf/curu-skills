# Curu Identity Pack Installation

## Prerequisites

- [ ] PAI core installed (`~/.claude/` directory exists)
- [ ] Claude Code CLI available
- [ ] Bun runtime installed

## Installation Steps

### Step 1: Symlink CORE skill from curu-skills

This pack references the CORE skill in the parent curu-skills repository:

```bash
CURU_SKILLS="/path/to/curu-skills"  # Adjust to your path
ln -sf "$CURU_SKILLS/CORE" ~/.claude/skills/CORE
```

Or if symlinking entire skills directory:

```bash
ln -sf /path/to/curu-skills ~/.claude/skills
```

### Step 2: Update settings.json with Curu identity

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

### Step 3: Verify installation

Run the verification procedure in [VERIFY.md](VERIFY.md).

## Skill Location

This pack references the CORE skill located at `../../CORE/` relative to this pack.

The CORE skill contains:
- `SKILL.md` - Skill definition and session-start context
- `USER/` - User profile files (ABOUTME.md, BASICINFO.md, DAIDENTITY.md, etc.)
- `Contacts.md` - Contact directory
- `CoreStack.md` - Technology preferences

## Uninstallation

```bash
# Remove symlink (not the source skill)
rm ~/.claude/skills/CORE
```

Then update `settings.json` to remove Curu-specific identity settings.
