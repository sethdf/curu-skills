---
name: AWS
description: Cross-account AWS operations with instance profile authentication. USE WHEN managing AWS resources, viewing costs, querying logs, checking security findings, or IAM operations.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/CORE/USER/SKILLCUSTOMIZATIONS/AWS/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# AWS Operations

Cross-account AWS management leveraging instance profile + sts:AssumeRole. No credential management required - auth-keeper handles everything automatically.

## Quick Start

```bash
aws-ops profile --list              # List configured accounts
aws-ops profile --set org-dev       # Switch to account
aws-ops resources                   # List EC2, S3, Lambda
aws-ops costs                       # View cost breakdown
aws-ops logs --group /aws/lambda/x  # Query CloudWatch logs
aws-ops security                    # Security Hub findings
```

## Architecture

This skill uses CLI-first design:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: AWS Skill (CLI)                                    │
│   aws-ops [command] [options]                               │
│   • Wraps AWS CLI with cross-account handling               │
│   • Deterministic operations only                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ uses
┌──────────────────────────▼──────────────────────────────────┐
│ AWS CLI + auth-keeper                                       │
│   • Instance profile credentials (auto-refresh)             │
│   • sts:AssumeRole for cross-account access                │
│   • No manual credential management                         │
└─────────────────────────────────────────────────────────────┘
```

## Authentication

**On imladris (EC2):** Instance profile provides base credentials. Cross-account access uses `sts:AssumeRole` configured in `~/.aws/config`.

**Profiles are managed by:** `aws-accounts-config` (see CLAUDE.md in imladris repo)

```bash
# View configured accounts
aws-accounts-config list

# Add new account
aws-accounts-config add

# Regenerate ~/.aws/config from BWS
aws-accounts-config generate
```

## Commands

### aws-ops profile

Manage AWS account/profile context.

```bash
aws-ops profile --list              # List all profiles
aws-ops profile --set org-dev       # Set active profile
aws-ops profile --current           # Show current profile
aws-ops profile --test              # Test access to current profile
aws-ops profile --test-all          # Test all configured profiles
```

### aws-ops resources

List and manage AWS resources.

```bash
aws-ops resources                   # All resource types
aws-ops resources --type ec2        # EC2 instances only
aws-ops resources --type s3         # S3 buckets
aws-ops resources --type lambda     # Lambda functions
aws-ops resources --type rds        # RDS databases
aws-ops resources --json            # JSON output
```

### aws-ops costs

View cost and usage data.

```bash
aws-ops costs                       # Last 30 days by service
aws-ops costs --days 7              # Last 7 days
aws-ops costs --by service          # Group by service (default)
aws-ops costs --by account          # Group by account
aws-ops costs --forecast            # Cost forecast
aws-ops costs --json                # JSON output
```

### aws-ops logs

Query CloudWatch logs.

```bash
aws-ops logs --list                 # List log groups
aws-ops logs --group /aws/lambda/x  # Query specific group
aws-ops logs --query "ERROR"        # Filter pattern
aws-ops logs --since "1 hour ago"   # Time filter
aws-ops logs --tail                 # Follow logs (live)
```

### aws-ops security

Security Hub findings and compliance.

```bash
aws-ops security                    # Active findings summary
aws-ops security --findings         # List all findings
aws-ops security --status ACTIVE    # Filter by status
aws-ops security --severity HIGH    # Filter by severity
aws-ops security --compliance       # Compliance summary
```

### aws-ops iam

IAM roles, policies, and access analysis.

```bash
aws-ops iam --roles                 # List roles
aws-ops iam --policies              # List policies
aws-ops iam --user bob              # Analyze user permissions
aws-ops iam --role my-role          # Analyze role permissions
```

## Workflows

| Workflow | Trigger | File |
|----------|---------|------|
| **ProfilePicker** | "switch account", "list profiles" | `Workflows/ProfilePicker.md` |
| **Resources** | "list instances", "show buckets" | `Workflows/Resources.md` |
| **Costs** | "show costs", "cost breakdown" | `Workflows/Costs.md` |
| **Logs** | "check logs", "cloudwatch" | `Workflows/Logs.md` |
| **Security** | "security findings", "compliance" | `Workflows/Security.md` |
| **IAM** | "list roles", "check permissions" | `Workflows/IAM.md` |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AWS_PROFILE` | Active profile | (from profile picker) |
| `AWS_REGION` | Default region | us-east-1 |
| `AWS_DEFAULT_OUTPUT` | Output format | json |

## Cross-Account Access

The imladris instance role has `sts:AssumeRole` permission. Each target account trusts this role:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::IMLADRIS_ACCOUNT:role/imladris-instance-role"
  },
  "Action": "sts:AssumeRole"
}
```

Profile naming convention:
- `{account-name}-readonly` → ReadOnlyAccess role
- `{account-name}-admin` → AdministratorAccess role

## Capabilities Matrix

| Workflow | Read Operations | Write Operations |
|----------|-----------------|------------------|
| Resources | List, describe, get configs | Start/stop, snapshots, modify |
| Costs | Reports, metrics, forecasts | Create budgets, set alerts |
| Logs | Query logs, list groups | Create groups, set retention |
| Security | Get findings, compliance | Update status, custom actions |
| IAM | List roles/policies, analyze | Create/modify (with confirmation) |

## Safety Notes

- Write operations require explicit confirmation
- AdministratorAccess profiles are marked with warnings
- IAM modifications logged and require double confirmation
- Cost alerts can be created but not deleted without confirmation
