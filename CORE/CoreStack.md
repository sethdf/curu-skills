# Core Stack Preferences

Technical preferences for code generation and tooling.

Generated: 2026-01-14

---

## Language Preferences

| Priority | Language | Use Case |
|----------|----------|----------|
| 1 | TypeScript | Primary for all new code |
| 2 | Bash | System automation, scripting |
| 3 | Python | Data science, ML, when required |
| 4 | Nix | Declarative system configuration |

---

## Package Managers

| Language | Manager | Never Use |
|----------|---------|-----------|
| JavaScript/TypeScript | bun | npm, yarn, pnpm |
| Python | uv | pip, pip3 |
| System packages | Nix/home-manager | apt, yum |

---

## Runtime

| Purpose | Tool |
|---------|------|
| JavaScript Runtime | Bun |
| Serverless | Cloudflare Workers, AWS Lambda |
| Containers | Docker (lazydocker for management) |

---

## Infrastructure

| Purpose | Tool |
|---------|------|
| IaC | Terraform |
| Config Management | Nix, home-manager |
| Secrets | Bitwarden Secrets Manager (BWS) |
| VPN | Tailscale |
| Cloud | AWS (multi-account via role assumption) |

---

## Markup Preferences

| Format | Use | Never Use |
|--------|-----|-----------|
| Markdown | All content, docs, notes | HTML for basic content |
| YAML | Configuration, frontmatter | - |
| JSON | API responses, data | - |

---

## Code Style

- Prefer explicit over clever
- No unnecessary abstractions
- Comments only where logic isn't self-evident
- Error messages should be actionable
- Security-first: validate at boundaries, encrypt sensitive data
