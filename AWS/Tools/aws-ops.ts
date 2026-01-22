#!/usr/bin/env bun
/**
 * AWS Operations CLI
 *
 * Cross-account AWS management with instance profile authentication.
 * Uses AWS CLI directly (wrapped by auth-keeper).
 *
 * Usage:
 *   aws-ops profile --list              # List profiles
 *   aws-ops profile --set org-dev       # Set profile
 *   aws-ops resources                   # List resources
 *   aws-ops costs                       # Cost breakdown
 *   aws-ops logs --group /aws/lambda/x  # Query logs
 *   aws-ops security                    # Security findings
 *   aws-ops iam --roles                 # List IAM roles
 */

import { $ } from "bun";

interface CliOptions {
  profile?: string;
  region?: string;
  type?: string;
  days?: number;
  by?: string;
  group?: string;
  query?: string;
  since?: string;
  status?: string;
  severity?: string;
  json: boolean;
  list: boolean;
  set?: string;
  current: boolean;
  test: boolean;
  testAll: boolean;
  findings: boolean;
  compliance: boolean;
  forecast: boolean;
  tail: boolean;
  roles: boolean;
  policies: boolean;
  user?: string;
  role?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; options: CliOptions } {
  const args = process.argv.slice(2);
  let command = "help";

  const options: CliOptions = {
    json: false,
    list: false,
    current: false,
    test: false,
    testAll: false,
    findings: false,
    compliance: false,
    forecast: false,
    tail: false,
    roles: false,
    policies: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Commands
    if (["profile", "resources", "costs", "logs", "security", "iam"].includes(arg)) {
      command = arg;
      continue;
    }

    // Options
    if (arg === "--profile" || arg === "-p") {
      options.profile = args[++i];
    } else if (arg === "--region" || arg === "-r") {
      options.region = args[++i];
    } else if (arg === "--type" || arg === "-t") {
      options.type = args[++i];
    } else if (arg === "--days" || arg === "-d") {
      options.days = parseInt(args[++i], 10);
    } else if (arg === "--by") {
      options.by = args[++i];
    } else if (arg === "--group" || arg === "-g") {
      options.group = args[++i];
    } else if (arg === "--query" || arg === "-q") {
      options.query = args[++i];
    } else if (arg === "--since") {
      options.since = args[++i];
    } else if (arg === "--status") {
      options.status = args[++i];
    } else if (arg === "--severity") {
      options.severity = args[++i];
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--list" || arg === "-l") {
      options.list = true;
    } else if (arg === "--set" || arg === "-s") {
      options.set = args[++i];
    } else if (arg === "--current") {
      options.current = true;
    } else if (arg === "--test") {
      options.test = true;
    } else if (arg === "--test-all") {
      options.testAll = true;
    } else if (arg === "--findings") {
      options.findings = true;
    } else if (arg === "--compliance") {
      options.compliance = true;
    } else if (arg === "--forecast") {
      options.forecast = true;
    } else if (arg === "--tail") {
      options.tail = true;
    } else if (arg === "--roles") {
      options.roles = true;
    } else if (arg === "--policies") {
      options.policies = true;
    } else if (arg === "--user") {
      options.user = args[++i];
    } else if (arg === "--role") {
      options.role = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      command = "help";
    }
  }

  return { command, options };
}

/**
 * Get AWS profile flag
 */
function profileFlag(profile?: string): string {
  const p = profile || process.env.AWS_PROFILE;
  return p ? `--profile ${p}` : "";
}

/**
 * Get AWS region flag
 */
function regionFlag(region?: string): string {
  const r = region || process.env.AWS_REGION || "us-east-1";
  return `--region ${r}`;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
AWS Operations CLI

Usage:
  aws-ops <command> [options]

Commands:
  profile     Manage AWS profiles/accounts
  resources   List AWS resources (EC2, S3, Lambda, RDS)
  costs       View cost and usage data
  logs        Query CloudWatch logs
  security    Security Hub findings
  iam         IAM roles, policies, analysis

Global Options:
  --profile, -p   AWS profile to use
  --region, -r    AWS region (default: us-east-1)
  --json          Output in JSON format
  --help, -h      Show help

Examples:
  aws-ops profile --list
  aws-ops profile --set org-dev-readonly
  aws-ops resources --type ec2
  aws-ops costs --days 7
  aws-ops logs --group /aws/lambda/my-func --since "1 hour ago"
  aws-ops security --severity HIGH
`);
}

/**
 * Profile management
 */
async function commandProfile(options: CliOptions): Promise<void> {
  if (options.list) {
    // List all profiles from ~/.aws/config
    const configFile = `${process.env.HOME}/.aws/config`;
    try {
      const config = await Bun.file(configFile).text();
      const profiles = config.match(/\[profile ([^\]]+)\]/g) || [];

      console.log("Configured AWS Profiles:\n");
      for (const p of profiles) {
        const name = p.replace("[profile ", "").replace("]", "");
        const isAdmin = name.includes("admin");
        const marker = isAdmin ? " ⚠️  (admin)" : "";
        console.log(`  ${name}${marker}`);
      }

      const current = process.env.AWS_PROFILE;
      if (current) {
        console.log(`\nActive: ${current}`);
      }
    } catch {
      console.error("No AWS config file found at ~/.aws/config");
    }
    return;
  }

  if (options.set) {
    // Export profile
    console.log(`\nTo set profile, run:`);
    console.log(`  export AWS_PROFILE=${options.set}`);
    console.log(`\nOr add to your shell:`);
    console.log(`  echo 'export AWS_PROFILE=${options.set}' >> ~/.zshrc`);
    return;
  }

  if (options.current) {
    const current = process.env.AWS_PROFILE || "(default)";
    console.log(`Current profile: ${current}`);
    return;
  }

  if (options.test) {
    const profile = options.profile || process.env.AWS_PROFILE;
    console.log(`Testing access for profile: ${profile || "(default)"}...`);
    try {
      const result = await $`aws ${profileFlag(profile)} sts get-caller-identity`.text();
      console.log("✓ Access confirmed:");
      console.log(result);
    } catch (error) {
      console.error("✗ Access failed:", error);
    }
    return;
  }

  if (options.testAll) {
    const configFile = `${process.env.HOME}/.aws/config`;
    try {
      const config = await Bun.file(configFile).text();
      const profiles = config.match(/\[profile ([^\]]+)\]/g) || [];

      console.log("Testing all profiles...\n");
      for (const p of profiles) {
        const name = p.replace("[profile ", "").replace("]", "");
        process.stdout.write(`  ${name}: `);
        try {
          await $`aws --profile ${name} sts get-caller-identity`.quiet();
          console.log("✓");
        } catch {
          console.log("✗");
        }
      }
    } catch {
      console.error("No AWS config file found");
    }
    return;
  }

  // Default: show current
  const current = process.env.AWS_PROFILE || "(default)";
  console.log(`Current profile: ${current}`);
  console.log("\nUse --list to see all profiles, --set <profile> to switch");
}

/**
 * List resources
 */
async function commandResources(options: CliOptions): Promise<void> {
  const pf = profileFlag(options.profile);
  const rf = regionFlag(options.region);
  const type = options.type?.toLowerCase();

  const resources: Record<string, any[]> = {};

  // EC2
  if (!type || type === "ec2") {
    try {
      const result = await $`aws ${pf} ${rf} ec2 describe-instances --query "Reservations[].Instances[].[InstanceId,State.Name,InstanceType,Tags[?Key=='Name'].Value|[0]]" --output json`.json();
      resources.ec2 = result || [];
    } catch {
      resources.ec2 = [];
    }
  }

  // S3
  if (!type || type === "s3") {
    try {
      const result = await $`aws ${pf} s3api list-buckets --query "Buckets[].Name" --output json`.json();
      resources.s3 = result || [];
    } catch {
      resources.s3 = [];
    }
  }

  // Lambda
  if (!type || type === "lambda") {
    try {
      const result = await $`aws ${pf} ${rf} lambda list-functions --query "Functions[].[FunctionName,Runtime,MemorySize]" --output json`.json();
      resources.lambda = result || [];
    } catch {
      resources.lambda = [];
    }
  }

  // RDS
  if (!type || type === "rds") {
    try {
      const result = await $`aws ${pf} ${rf} rds describe-db-instances --query "DBInstances[].[DBInstanceIdentifier,DBInstanceClass,Engine,DBInstanceStatus]" --output json`.json();
      resources.rds = result || [];
    } catch {
      resources.rds = [];
    }
  }

  if (options.json) {
    console.log(JSON.stringify(resources, null, 2));
    return;
  }

  // Human-readable output
  console.log("\n📦 AWS Resources\n");

  if (resources.ec2?.length > 0) {
    console.log("EC2 Instances:");
    for (const [id, state, type, name] of resources.ec2) {
      const stateIcon = state === "running" ? "🟢" : "⚪";
      console.log(`  ${stateIcon} ${id} (${type}) - ${name || "(unnamed)"}`);
    }
    console.log("");
  }

  if (resources.s3?.length > 0) {
    console.log("S3 Buckets:");
    for (const name of resources.s3) {
      console.log(`  📁 ${name}`);
    }
    console.log("");
  }

  if (resources.lambda?.length > 0) {
    console.log("Lambda Functions:");
    for (const [name, runtime, memory] of resources.lambda) {
      console.log(`  λ ${name} (${runtime}, ${memory}MB)`);
    }
    console.log("");
  }

  if (resources.rds?.length > 0) {
    console.log("RDS Databases:");
    for (const [id, instanceClass, engine, status] of resources.rds) {
      const statusIcon = status === "available" ? "🟢" : "⚪";
      console.log(`  ${statusIcon} ${id} (${engine}, ${instanceClass})`);
    }
    console.log("");
  }
}

/**
 * Cost analysis
 */
async function commandCosts(options: CliOptions): Promise<void> {
  const pf = profileFlag(options.profile);
  const days = options.days || 30;
  const groupBy = options.by || "service";

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const groupDimension = groupBy === "account" ? "LINKED_ACCOUNT" : "SERVICE";

    const result = await $`aws ${pf} ce get-cost-and-usage \
      --time-period Start=${startDate},End=${endDate} \
      --granularity MONTHLY \
      --metrics "BlendedCost" \
      --group-by Type=DIMENSION,Key=${groupDimension} \
      --output json`.json();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n💰 AWS Costs (${startDate} to ${endDate})\n`);

    const costsByGroup: Record<string, number> = {};
    let total = 0;

    for (const period of result.ResultsByTime || []) {
      for (const group of period.Groups || []) {
        const name = group.Keys?.[0] || "Unknown";
        const amount = parseFloat(group.Metrics?.BlendedCost?.Amount || "0");
        costsByGroup[name] = (costsByGroup[name] || 0) + amount;
        total += amount;
      }
    }

    // Sort by cost descending
    const sorted = Object.entries(costsByGroup).sort((a, b) => b[1] - a[1]);

    for (const [name, amount] of sorted) {
      if (amount > 0.01) {
        console.log(`  $${amount.toFixed(2).padStart(10)} - ${name}`);
      }
    }

    console.log(`\n  $${total.toFixed(2).padStart(10)} - TOTAL\n`);
  } catch (error) {
    console.error("Failed to get cost data:", error);
    console.log("\nNote: Cost Explorer requires organization access and may not be available on all accounts.");
  }

  if (options.forecast) {
    try {
      const forecastEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const forecast = await $`aws ${pf} ce get-cost-forecast \
        --time-period Start=${endDate},End=${forecastEnd} \
        --granularity MONTHLY \
        --metric BLENDED_COST \
        --output json`.json();

      console.log("📊 Forecast (next 30 days):");
      console.log(`  Predicted: $${parseFloat(forecast.Total?.Amount || "0").toFixed(2)}`);
    } catch {
      console.log("Forecast not available.");
    }
  }
}

/**
 * CloudWatch logs
 */
async function commandLogs(options: CliOptions): Promise<void> {
  const pf = profileFlag(options.profile);
  const rf = regionFlag(options.region);

  if (options.list || !options.group) {
    // List log groups
    try {
      const result = await $`aws ${pf} ${rf} logs describe-log-groups --query "logGroups[].logGroupName" --output json`.json();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n📋 CloudWatch Log Groups:\n");
      for (const name of result || []) {
        console.log(`  ${name}`);
      }
      console.log("");
    } catch (error) {
      console.error("Failed to list log groups:", error);
    }
    return;
  }

  // Query specific log group
  const group = options.group;
  const since = options.since || "1 hour ago";

  // Convert human-readable time to epoch
  let startTime: number;
  const now = Date.now();
  if (since.includes("minute")) {
    const mins = parseInt(since) || 60;
    startTime = now - mins * 60 * 1000;
  } else if (since.includes("hour")) {
    const hours = parseInt(since) || 1;
    startTime = now - hours * 60 * 60 * 1000;
  } else if (since.includes("day")) {
    const days = parseInt(since) || 1;
    startTime = now - days * 24 * 60 * 60 * 1000;
  } else {
    startTime = now - 60 * 60 * 1000; // Default 1 hour
  }

  try {
    let cmd = `aws ${pf} ${rf} logs filter-log-events \
      --log-group-name "${group}" \
      --start-time ${startTime}`;

    if (options.query) {
      cmd += ` --filter-pattern "${options.query}"`;
    }

    cmd += " --output json";

    const result = await $`sh -c ${cmd}`.json();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n📋 Logs from ${group}:\n`);
    for (const event of result.events || []) {
      const time = new Date(event.timestamp).toISOString();
      console.log(`[${time}] ${event.message}`);
    }
  } catch (error) {
    console.error("Failed to query logs:", error);
  }
}

/**
 * Security Hub findings
 */
async function commandSecurity(options: CliOptions): Promise<void> {
  const pf = profileFlag(options.profile);
  const rf = regionFlag(options.region);

  if (options.compliance) {
    try {
      const result = await $`aws ${pf} ${rf} securityhub get-findings-statistics \
        --group-by-attribute ComplianceStatus \
        --output json`.json();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n🔒 Compliance Status:\n");
      for (const stat of result.GroupByAttributeResults || []) {
        console.log(`  ${stat.AttributeKey}: ${stat.AttributeValue} (${stat.Count} findings)`);
      }
    } catch {
      console.log("Security Hub not enabled or no findings available.");
    }
    return;
  }

  // Get findings
  try {
    let filters: any = {};

    if (options.status) {
      filters.WorkflowStatus = [{ Comparison: "EQUALS", Value: options.status }];
    } else {
      filters.WorkflowStatus = [{ Comparison: "EQUALS", Value: "NEW" }];
    }

    if (options.severity) {
      filters.SeverityLabel = [{ Comparison: "EQUALS", Value: options.severity }];
    }

    const result = await $`aws ${pf} ${rf} securityhub get-findings \
      --filters '${JSON.stringify(filters)}' \
      --max-items 50 \
      --output json`.json();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log("\n🔒 Security Hub Findings:\n");

    const findings = result.Findings || [];
    if (findings.length === 0) {
      console.log("  No findings match the criteria.");
      return;
    }

    // Group by severity
    const bySeverity: Record<string, any[]> = {};
    for (const f of findings) {
      const sev = f.Severity?.Label || "UNKNOWN";
      bySeverity[sev] = bySeverity[sev] || [];
      bySeverity[sev].push(f);
    }

    const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL", "UNKNOWN"];
    for (const sev of severityOrder) {
      const items = bySeverity[sev];
      if (items?.length > 0) {
        const icon = sev === "CRITICAL" ? "🔴" : sev === "HIGH" ? "🟠" : sev === "MEDIUM" ? "🟡" : "🟢";
        console.log(`${icon} ${sev} (${items.length}):`);
        for (const f of items.slice(0, 5)) {
          console.log(`    - ${f.Title}`);
        }
        if (items.length > 5) {
          console.log(`    ... and ${items.length - 5} more`);
        }
        console.log("");
      }
    }
  } catch (error) {
    console.error("Failed to get security findings:", error);
    console.log("\nSecurity Hub may not be enabled in this account/region.");
  }
}

/**
 * IAM operations
 */
async function commandIam(options: CliOptions): Promise<void> {
  const pf = profileFlag(options.profile);

  if (options.roles) {
    try {
      const result = await $`aws ${pf} iam list-roles --query "Roles[].[RoleName,CreateDate]" --output json`.json();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n👤 IAM Roles:\n");
      for (const [name, created] of result || []) {
        console.log(`  ${name}`);
      }
    } catch (error) {
      console.error("Failed to list roles:", error);
    }
    return;
  }

  if (options.policies) {
    try {
      const result = await $`aws ${pf} iam list-policies --scope Local --query "Policies[].[PolicyName,Arn]" --output json`.json();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n📜 Custom IAM Policies:\n");
      for (const [name] of result || []) {
        console.log(`  ${name}`);
      }
    } catch (error) {
      console.error("Failed to list policies:", error);
    }
    return;
  }

  if (options.user) {
    try {
      const policies = await $`aws ${pf} iam list-attached-user-policies --user-name ${options.user} --query "AttachedPolicies[].PolicyName" --output json`.json();
      const groups = await $`aws ${pf} iam list-groups-for-user --user-name ${options.user} --query "Groups[].GroupName" --output json`.json();

      console.log(`\n👤 User: ${options.user}\n`);
      console.log("Attached Policies:");
      for (const p of policies || []) {
        console.log(`  - ${p}`);
      }
      console.log("\nGroups:");
      for (const g of groups || []) {
        console.log(`  - ${g}`);
      }
    } catch (error) {
      console.error("Failed to analyze user:", error);
    }
    return;
  }

  if (options.role) {
    try {
      const policies = await $`aws ${pf} iam list-attached-role-policies --role-name ${options.role} --query "AttachedPolicies[].PolicyName" --output json`.json();
      const trustPolicy = await $`aws ${pf} iam get-role --role-name ${options.role} --query "Role.AssumeRolePolicyDocument" --output json`.json();

      console.log(`\n👤 Role: ${options.role}\n`);
      console.log("Attached Policies:");
      for (const p of policies || []) {
        console.log(`  - ${p}`);
      }
      console.log("\nTrust Policy:");
      console.log(JSON.stringify(trustPolicy, null, 2));
    } catch (error) {
      console.error("Failed to analyze role:", error);
    }
    return;
  }

  // Default: show summary
  console.log("\nIAM Commands:");
  console.log("  --roles      List all roles");
  console.log("  --policies   List custom policies");
  console.log("  --user NAME  Analyze user permissions");
  console.log("  --role NAME  Analyze role permissions");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, options } = parseArgs();

  switch (command) {
    case "profile":
      await commandProfile(options);
      break;
    case "resources":
      await commandResources(options);
      break;
    case "costs":
      await commandCosts(options);
      break;
    case "logs":
      await commandLogs(options);
      break;
    case "security":
      await commandSecurity(options);
      break;
    case "iam":
      await commandIam(options);
      break;
    case "help":
    default:
      printUsage();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
