# Costs Workflow

View and analyze AWS cost and usage data.

## Quick Usage

```bash
# Last 30 days by service
aws-ops costs

# Custom time range
aws-ops costs --days 7
aws-ops costs --days 90

# Group by account (for organizations)
aws-ops costs --by account

# Include forecast
aws-ops costs --forecast

# JSON output
aws-ops costs --json
```

## Example Output

```
💰 AWS Costs (2025-12-23 to 2026-01-22)

     $125.50 - Amazon Elastic Compute Cloud - Compute
      $45.20 - Amazon Simple Storage Service
      $22.10 - AWS Lambda
       $8.50 - Amazon CloudWatch
       $3.20 - AWS Key Management Service

     $204.50 - TOTAL

📊 Forecast (next 30 days):
  Predicted: $210.00
```

## Requirements

- Cost Explorer must be enabled in the account
- For organization-level costs, use management account profile
- API calls may incur small charges (~$0.01 per request)

## Detailed Analysis

For more detailed cost analysis, use AWS CLI:

```bash
# Daily granularity
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-22 \
  --granularity DAILY \
  --metrics "BlendedCost"

# By resource tag
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-22 \
  --granularity MONTHLY \
  --group-by Type=TAG,Key=Project

# Reservations
aws ce get-reservation-utilization \
  --time-period Start=2026-01-01,End=2026-01-22
```

## Budget Alerts

Create budget alerts via AWS CLI:

```bash
# Create monthly budget
aws budgets create-budget \
  --account-id 111111111111 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

## Cost Optimization Tips

1. **Right-size EC2** - Use Compute Optimizer recommendations
2. **Reserved Instances** - Commit for 1-3 years for savings
3. **Spot Instances** - For fault-tolerant workloads
4. **S3 Lifecycle** - Move old data to cheaper tiers
5. **Lambda Optimization** - Right-size memory allocation
