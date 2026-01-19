---
name: Curu Identity Pack
pack-id: sethdf-curu-identity-pack-v1.0.0
version: 1.0.0
author: sethdf
description: Personal AI identity configuration for Curu - defines AI assistant identity, user info, response format, contacts, and tech stack preferences
type: identity
purpose-type: [identity, configuration]
platform: claude-code
dependencies: [pai-core-install]
keywords: [identity, curu, user, configuration, preferences]
---

# Curu Identity Pack (curu-identity-pack)

> Personal AI identity and user configuration for the Curu AI assistant

> **Installation:** This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using the wizard in `INSTALL.md`.

---

## What's Included

| Component | Count | Purpose |
|-----------|-------|---------|
| USER/ files | 14 | User identity and preference files |
| SKILL.md | 1 | CORE skill definition |
| Config files | 2 | Contacts and tech stack |

**Summary:**
- **Files created:** 17
- **Skill registered:** CORE (auto-loads at session start)
- **Dependencies:** pai-core-install (foundation pack)

## The Problem

Without a personalized identity configuration:
- AI responses are generic and impersonal
- No knowledge of user preferences, contacts, or tech stack
- Session context starts cold every time
- Response format inconsistent

## The Solution

The Curu Identity Pack provides:

1. **AI Identity (DAIDENTITY.md)**: Curu persona - etymology, role, voice
2. **User Identity (BASICINFO.md, ABOUTME.md)**: Seth's info, timezone, environment
3. **Contacts Directory (CONTACTS.md)**: Contact information with communication preferences
4. **Tech Stack (TECHSTACKPREFERENCES.md)**: Bun, TypeScript, Terraform, AWS preferences
5. **Response Format**: Emoji-based structured responses

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Verification

See [VERIFY.md](VERIFY.md) for testing and verification procedures.

## Configuration

**Environment variables (set in settings.json):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `DA` | `Curu` | AI assistant name |
| `TIME_ZONE` | `America/Denver` | User timezone |
| `PAI_SOURCE_APP` | `Curu` | Source identifier for observability |

## Pack Contents

### USER/ Directory

| File | Purpose |
|------|---------|
| ABOUTME.md | User background and context |
| BASICINFO.md | Name, timezone, location |
| DAIDENTITY.md | Curu identity definition |
| CONTACTS.md | Contact directory |
| TECHSTACKPREFERENCES.md | Development preferences |
| TELOS.md | Goals and objectives |
| RESUME.md | Professional background |
| CORECONTENT.md | Core content preferences |
| DEFINITIONS.md | Term definitions |
| REMINDERS.md | Standing reminders |
| ALGOPREFS.md | Algorithm preferences |
| ART.md | Art/design preferences |
| ASSETMANAGEMENT.md | Asset handling |
| PAISECURITYSYSTEM/ | Security patterns |

### SKILL.md

Defines the CORE skill that:
- Auto-loads at session start
- Sets identity context
- Defines response format
- Links to detailed configuration files

## Credits

- **Author**: Seth (sethdf)
- **AI Assistant**: Curu
- **Framework**: PAI (Personal AI Infrastructure)

## Changelog

### 1.0.0 - 2026-01-19
- Initial release
- Extracted from curu-skills repository
- PAI-compliant pack structure
