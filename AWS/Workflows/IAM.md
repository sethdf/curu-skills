# IAM Workflow

Manage and analyze IAM roles, policies, and permissions.

## Quick Usage

```bash
# List all roles
aws-ops iam --roles

# List custom policies
aws-ops iam --policies

# Analyze user permissions
aws-ops iam --user bob

# Analyze role permissions
aws-ops iam --role my-lambda-role
```

## Example Output

```
👤 Role: my-lambda-role

Attached Policies:
  - AWSLambdaBasicExecutionRole
  - AmazonS3ReadOnlyAccess

Trust Policy:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

## Common Operations

### Create Role

```bash
# Create role with trust policy
aws iam create-role \
  --role-name MyNewRole \
  --assume-role-policy-document file://trust-policy.json

# Attach managed policy
aws iam attach-role-policy \
  --role-name MyNewRole \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

### Create Policy

```bash
# Create custom policy
aws iam create-policy \
  --policy-name MyCustomPolicy \
  --policy-document file://policy.json
```

### Access Analyzer

Find unused access:

```bash
# List access analyzers
aws accessanalyzer list-analyzers

# Get findings
aws accessanalyzer list-findings --analyzer-arn <arn>
```

## Permission Boundaries

Set permission boundaries for least privilege:

```bash
# Set boundary on role
aws iam put-role-permissions-boundary \
  --role-name MyRole \
  --permissions-boundary arn:aws:iam::123456789012:policy/MyBoundary
```

## Best Practices

1. **Least Privilege** - Grant only required permissions
2. **Use Roles** - Prefer roles over users for services
3. **MFA** - Require MFA for privileged access
4. **Regular Audits** - Review permissions regularly
5. **Access Analyzer** - Use to find unused access
6. **Permission Boundaries** - Limit maximum permissions

## Security Warnings

⚠️ **Write operations to IAM require careful review:**
- Creating policies can grant broad access
- Modifying trust policies can allow cross-account access
- Deleting policies may break applications

Always use `--dry-run` equivalent (describe first) before modifications.
