---
name: Auth Pack
pack-id: sethdf-auth-pack-v1.0.0
version: 1.0.0
author: sethdf
description: Multi-cloud authentication management for Claude Code - unified auth-keeper for AWS, Azure, MS365, Google, Slack, Telegram, Signal, and ServiceDesk Plus
type: infrastructure
purpose-type: [authentication, security, infrastructure]
platform: claude-code
dependencies: [pai-core-install, bws-cli]
keywords: [auth, authentication, oauth, aws, azure, ms365, google, slack, telegram, signal, sdp, servicedesk]
---

# Auth Pack (auth-pack)

> Multi-cloud authentication infrastructure for Claude Code

> **Installation:** This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using the wizard in `INSTALL.md`.

---

## What's Included

| Component | Purpose |
|-----------|---------|
| auth-keeper.sh | Main authentication manager - status, refresh, login for all services |
| asudo.sh | Secure sudo wrapper with credential handling |
| bws-init.sh | Bitwarden Secrets Manager initialization |
| claude-backend.sh | AWS Bedrock backend switching utility |

**Summary:**
- **Scripts:** 4
- **Supported services:** 8 (AWS, Azure, MS365, Google, Slack, Telegram, Signal, SDP)
- **Dependencies:** bws (Bitwarden Secrets), AWS CLI, Azure CLI, signal-cli

## The Problem

Managing authentication across multiple cloud providers and communication platforms is complex:

- Each service has different auth flows (OAuth, OIDC, API tokens, device codes)
- Tokens expire at different intervals
- No unified status view
- Manual refresh processes are error-prone
- Secrets scattered across different locations

## The Solution

Auth Pack provides:

1. **Unified Status**: `auth-keeper status` shows health of all services
2. **Smart Refresh**: `auth-keeper refresh <service>` handles token refresh
3. **Secure Storage**: All tokens in encrypted LUKS volume, secrets in BWS
4. **Service Abstraction**: Common interface regardless of auth method

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Verification

See [VERIFY.md](VERIFY.md) for testing and verification procedures.

## Usage

### Check all service status

```bash
auth-keeper status
```

### Refresh a specific service

```bash
auth-keeper refresh ms365
auth-keeper refresh google
auth-keeper refresh slack
```

### Login to a service

```bash
auth-keeper login aws
auth-keeper login azure
```

### Switch Claude backend

```bash
claude-backend.sh bedrock   # Use AWS Bedrock
claude-backend.sh personal  # Use personal API
```

## Supported Services

| Service | Auth Type | Token Location |
|---------|-----------|----------------|
| AWS | IAM Identity Center | ~/.aws/sso/cache/ |
| Azure | Device Code Flow | ~/.azure/ |
| MS365 (Graph) | OAuth2 Refresh | ~/.claude/.credentials.json |
| Google (Gmail/Calendar) | OAuth2 Refresh | ~/.claude/.credentials.json |
| Slack | OAuth2 Token | ~/.claude/.credentials.json |
| Telegram | Bot Token | BWS |
| Signal | Linked Device | ~/.local/share/signal-cli/ |
| SDP (ServiceDesk Plus) | API Key | BWS |

## Architecture

```
+------------------+
|   auth-keeper    |  <-- Unified interface
+------------------+
        |
        v
+------------------+
|  Service Layer   |
|  - aws_*()       |
|  - azure_*()     |
|  - ms365_*()     |
|  - google_*()    |
|  - slack_*()     |
|  - telegram_*()  |
|  - signal_*()    |
|  - sdp_*()       |
+------------------+
        |
        v
+------------------+
|  Token Storage   |
|  - BWS (secrets) |
|  - .credentials  |
|  - Service CLIs  |
+------------------+
```

## Configuration

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `BWS_ACCESS_TOKEN` | BWS authentication |
| `AWS_PROFILE` | AWS profile for SSO |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription |
| `MS365_CLIENT_ID` | MS365 app client ID |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |

### Credential File

`~/.claude/.credentials.json`:
```json
{
  "ms365": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "..."
  },
  "google": { ... },
  "slack": { ... }
}
```

## Security Model

1. **No plaintext secrets in git** - All secrets via BWS
2. **Encrypted at rest** - Credentials on LUKS volume
3. **Token rotation** - Auto-refresh before expiry
4. **Least privilege** - Service-specific scopes

## Credits

- **Author**: Seth (sethdf)
- **Framework**: PAI (Personal AI Infrastructure)
- **Integrations**: AWS, Azure, Microsoft Graph, Google APIs, Slack, Telegram, Signal

## Changelog

### 1.0.0 - 2026-01-19
- Initial release
- Extracted from imladris repository
- PAI-compliant pack structure
