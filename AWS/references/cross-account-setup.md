# Cross-Account AWS Setup

How to configure cross-account access for imladris.

## Overview

The imladris EC2 instance uses an instance profile with `sts:AssumeRole` permission. Each target AWS account must trust this role.

## Instance Role

The imladris instance role (in the imladris account):
```
arn:aws:iam::IMLADRIS_ACCOUNT_ID:role/imladris-instance-role
```

This role has permission to assume roles in other accounts:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::*:role/*"
  }]
}
```

## Target Account Setup

In each target account, create roles that trust the imladris instance role:

### ReadOnlyAccess Role

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::IMLADRIS_ACCOUNT_ID:role/imladris-instance-role"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

Attach the `ReadOnlyAccess` managed policy.

### AdministratorAccess Role

Same trust policy, attach `AdministratorAccess` managed policy.

## AWS Config

After creating roles, register them in BWS and generate config:

```bash
# Add to aws-cross-accounts secret in BWS
bws secret edit aws-cross-accounts

# Add entry:
{
  "id": "111111111111",
  "name": "org-dev",
  "roles": ["ReadOnlyAccess", "AdministratorAccess"],
  "purpose": "Development environment"
}

# Regenerate ~/.aws/config
aws-accounts-config generate
```

## Resulting Config

```ini
[default]
region = us-east-1

[profile org-dev-readonly]
role_arn = arn:aws:iam::111111111111:role/ReadOnlyAccess
credential_source = Ec2InstanceMetadata
region = us-east-1

[profile org-dev-admin]
role_arn = arn:aws:iam::111111111111:role/AdministratorAccess
credential_source = Ec2InstanceMetadata
region = us-east-1
```

## Testing

```bash
# Test specific profile
aws --profile org-dev-readonly sts get-caller-identity

# Test all profiles
aws-ops profile --test-all
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Access Denied | Trust policy missing | Add imladris role to trust policy |
| Invalid identity token | Instance not on EC2 | Use SSO instead |
| Role not found | Wrong role name | Check role ARN in config |
| Throttling | Too many AssumeRole calls | Add delay between operations |

## Security Considerations

1. **Limit trust** - Only trust from imladris instance role
2. **Audit access** - CloudTrail logs all AssumeRole calls
3. **Rotate nothing** - Instance credentials auto-rotate
4. **Separate roles** - Use readonly for exploration, admin only when needed
