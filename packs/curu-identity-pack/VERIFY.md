# Curu Identity Pack Verification

## Automated Checks

Run these commands to verify installation:

### 1. Check CORE skill exists

```bash
ls -la ~/.claude/skills/CORE/SKILL.md
# Expected: File exists with CORE skill definition
```

### 2. Check USER directory

```bash
ls ~/.claude/skills/CORE/USER/ | wc -l
# Expected: 14 or more files
```

### 3. Check settings.json identity

```bash
grep -q '"DA": "Curu"' ~/.claude/settings.json && echo "✓ DA=Curu" || echo "✗ DA not set"
grep -q '"name": "Curu"' ~/.claude/settings.json && echo "✓ daidentity.name=Curu" || echo "✗ daidentity.name not set"
```

## Manual Verification

### 1. Start a new Claude Code session

```bash
claude
```

### 2. Verify identity context loads

At session start, you should see the PAI context loaded message indicating the CORE skill was injected.

### 3. Test identity response

Ask: "What is your name and who am I?"

Expected response should include:
- AI name: Curu
- User name: Seth
- Reference to etymology (Curunír)

### 4. Test contacts lookup

Ask: "What contacts do I have?"

Expected: Should list contacts from CONTACTS.md

### 5. Test tech stack preferences

Ask: "What package manager should I use?"

Expected: "bun" (never npm/yarn/pnpm)

## Troubleshooting

### Identity not loading

1. Check SessionStart hooks are configured in settings.json
2. Verify LoadContext.hook.ts exists and is executable
3. Check SKILL.md has correct YAML frontmatter

### Wrong identity

1. Verify `DA` environment variable in settings.json
2. Check `daidentity` section in settings.json
3. Ensure no conflicting USER/ files

## Success Criteria

- [ ] CORE skill directory exists with all files
- [ ] Session starts with Curu identity loaded
- [ ] AI identifies as Curu, user as Seth
- [ ] Tech stack preferences return correct values
- [ ] Contacts are accessible
