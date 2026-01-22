# Profile Picker Workflow

Select and manage AWS account/profile context.

## Quick Usage

```bash
# List all configured profiles
aws-ops profile --list

# Set active profile
aws-ops profile --set org-dev-readonly
export AWS_PROFILE=org-dev-readonly

# Test current profile
aws-ops profile --test

# Test all profiles
aws-ops profile --test-all
```

## Profile Management

Profiles are stored in `~/.aws/config` and managed by `aws-accounts-config`.

### Adding New Accounts

```bash
# Interactive add
aws-accounts-config add

# Regenerate config from BWS
aws-accounts-config generate
```

### Profile Naming Convention

| Pattern | Role | Use Case |
|---------|------|----------|
| `{name}-readonly` | ReadOnlyAccess | Safe exploration |
| `{name}-admin` | AdministratorAccess | Full management |

### Example Config

```ini
[profile org-dev-readonly]
role_arn = arn:aws:iam::111111111111:role/ReadOnlyAccess
source_profile = default

[profile org-dev-admin]
role_arn = arn:aws:iam::111111111111:role/AdministratorAccess
source_profile = default
```

## Best Practices

1. **Start with readonly** - Use readonly profiles for exploration
2. **Switch explicitly** - Always know which profile is active
3. **Test after switching** - Run `aws-ops profile --test` to confirm access
4. **Admin with caution** - Admin profiles are marked with ⚠️ in listing
