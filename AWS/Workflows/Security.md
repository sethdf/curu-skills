# Security Workflow

View Security Hub findings and compliance status.

## Quick Usage

```bash
# Active findings summary
aws-ops security

# All findings
aws-ops security --findings

# Filter by status
aws-ops security --status NEW
aws-ops security --status RESOLVED

# Filter by severity
aws-ops security --severity CRITICAL
aws-ops security --severity HIGH

# Compliance summary
aws-ops security --compliance
```

## Example Output

```
🔒 Security Hub Findings:

🔴 CRITICAL (2):
    - S3 bucket without encryption
    - IAM user with console access and no MFA

🟠 HIGH (5):
    - Security group allows unrestricted SSH
    - RDS instance publicly accessible
    - CloudTrail logging disabled
    ... and 2 more

🟡 MEDIUM (12):
    - EC2 instance without IMDSv2
    - S3 bucket without versioning
    ... and 10 more
```

## Security Hub Setup

Security Hub must be enabled:

```bash
# Enable Security Hub
aws securityhub enable-security-hub

# Enable AWS Foundational Security Best Practices
aws securityhub batch-enable-standards \
  --standards-subscription-requests \
    StandardsArn=arn:aws:securityhub:::ruleset/aws-foundational-security-best-practices/v/1.0.0
```

## Finding Management

Update finding status:

```bash
# Mark as resolved
aws securityhub batch-update-findings \
  --finding-identifiers '{"Id":"arn:aws:securityhub:...","ProductArn":"arn:aws:securityhub:..."}' \
  --workflow Status=RESOLVED

# Add note
aws securityhub batch-update-findings \
  --finding-identifiers '{"Id":"...","ProductArn":"..."}' \
  --note Text="Accepted risk per security review",UpdatedBy="security-team"
```

## Compliance Standards

Common standards:
- AWS Foundational Security Best Practices
- CIS AWS Foundations Benchmark
- PCI DSS
- NIST 800-53

View enabled standards:

```bash
aws securityhub get-enabled-standards
```

## Integration with Other Services

Security Hub aggregates from:
- Amazon GuardDuty
- Amazon Inspector
- AWS Config
- IAM Access Analyzer
- Amazon Macie
