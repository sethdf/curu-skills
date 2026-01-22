# Resources Workflow

List and manage AWS resources.

## Quick Usage

```bash
# List all resources
aws-ops resources

# Filter by type
aws-ops resources --type ec2
aws-ops resources --type s3
aws-ops resources --type lambda
aws-ops resources --type rds

# JSON output
aws-ops resources --json
```

## Supported Resource Types

| Type | Description | Info Shown |
|------|-------------|------------|
| `ec2` | EC2 instances | ID, state, type, name |
| `s3` | S3 buckets | Bucket name |
| `lambda` | Lambda functions | Name, runtime, memory |
| `rds` | RDS databases | ID, engine, class, status |

## Example Output

```
📦 AWS Resources

EC2 Instances:
  🟢 i-0abc123 (t3.medium) - web-server-1
  ⚪ i-0def456 (t3.large) - db-server-1

S3 Buckets:
  📁 my-app-data
  📁 my-app-logs

Lambda Functions:
  λ process-orders (nodejs18.x, 256MB)
  λ send-notifications (python3.9, 128MB)

RDS Databases:
  🟢 myapp-db (mysql, db.t3.medium)
```

## Direct AWS CLI

For more detailed queries, use AWS CLI directly:

```bash
# EC2 with all details
aws ec2 describe-instances

# S3 with versioning status
aws s3api get-bucket-versioning --bucket my-bucket

# Lambda with environment variables
aws lambda get-function-configuration --function-name my-func
```

## Write Operations

The resources command is read-only. For write operations, use AWS CLI:

```bash
# Start/stop EC2
aws ec2 start-instances --instance-ids i-0abc123
aws ec2 stop-instances --instance-ids i-0abc123

# Create snapshot
aws ec2 create-snapshot --volume-id vol-xxx --description "Backup"
```
