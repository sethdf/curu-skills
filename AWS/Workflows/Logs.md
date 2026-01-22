# Logs Workflow

Query and analyze CloudWatch logs.

## Quick Usage

```bash
# List log groups
aws-ops logs --list

# Query specific log group
aws-ops logs --group /aws/lambda/my-function

# Filter by pattern
aws-ops logs --group /aws/lambda/my-function --query "ERROR"

# Time filter
aws-ops logs --group /aws/lambda/my-function --since "2 hours ago"

# Combine filters
aws-ops logs --group /aws/lambda/my-function --query "ERROR" --since "1 day ago"
```

## Time Filters

Supported time formats:
- `X minutes ago`
- `X hours ago`
- `X days ago`

## Example Output

```
📋 Logs from /aws/lambda/my-function:

[2026-01-22T15:30:00.000Z] START RequestId: abc-123
[2026-01-22T15:30:00.100Z] Processing order 12345
[2026-01-22T15:30:00.500Z] Order processed successfully
[2026-01-22T15:30:00.510Z] END RequestId: abc-123
```

## CloudWatch Insights

For complex queries, use CloudWatch Logs Insights:

```bash
aws logs start-query \
  --log-group-name /aws/lambda/my-function \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'
```

## Log Retention

Set log retention to manage costs:

```bash
# Set 30-day retention
aws logs put-retention-policy \
  --log-group-name /aws/lambda/my-function \
  --retention-in-days 30

# View current retention
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/my-function \
  --query "logGroups[].retentionInDays"
```

## Metric Filters

Create metric filters for alerting:

```bash
# Create filter for errors
aws logs put-metric-filter \
  --log-group-name /aws/lambda/my-function \
  --filter-name "ErrorCount" \
  --filter-pattern "ERROR" \
  --metric-transformations \
    metricName=ErrorCount,metricNamespace=MyApp,metricValue=1
```

## Common Patterns

| Pattern | Description |
|---------|-------------|
| `ERROR` | Any error message |
| `"error"` | Exact match for "error" |
| `?ERROR ?WARN` | ERROR or WARN |
| `[timestamp, level=ERROR, ...]` | Structured logs |
