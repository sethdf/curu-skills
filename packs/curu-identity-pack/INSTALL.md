# Curu Identity Pack Installation

## Prerequisites

- [ ] Claude Code CLI installed (`~/.claude/` directory exists)
- [ ] Bun runtime installed

## What This Pack Does

Installs Curu identity files to `~/.claude/USER/` following the PAI pattern:
- AI identity (Curu)
- User info (Seth)
- Tech stack preferences
- Contacts

## Installation Steps

### Step 1: Copy USER directory to ~/.claude/

```bash
# From the pack directory
cp -r src/USER/* ~/.claude/USER/
```

Or with the pack path:

```bash
PACK_DIR="/path/to/curu-skills/packs/curu-identity-pack"
mkdir -p ~/.claude/USER
cp -r "$PACK_DIR/src/USER/"* ~/.claude/USER/
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

## Identity Files

This pack installs the following to `~/.claude/USER/`:

| File | Purpose |
|------|---------|
| DAIDENTITY.md | Curu AI identity definition |
| BASICINFO.md | User basic info (Seth) |
| TECHSTACKPREFERENCES.md | Tech stack (Bun, TypeScript, etc.) |
| CONTACTS.md | Contact directory |
| ABOUTME.md | User background |
| CoreStack.md | Additional stack preferences |
| Contacts.md | Alternative contacts format |
| PAISECURITYSYSTEM/ | Security patterns |

## How It Works

The `load-core-context.ts` SessionStart hook reads from `~/.claude/USER/` and injects identity context into each session. This follows the PAI pattern where:

- `~/.claude/USER/` = Identity (not a skill)
- `~/.claude/skills/` = Action skills only

## Uninstallation

```bash
rm -rf ~/.claude/USER/*
```

Then update `settings.json` to remove Curu-specific identity settings.

## Rebuilding

To rebuild identity from source:

```bash
PACK_DIR="/path/to/curu-skills/packs/curu-identity-pack"
rm -rf ~/.claude/USER/*
cp -r "$PACK_DIR/src/USER/"* ~/.claude/USER/
```
