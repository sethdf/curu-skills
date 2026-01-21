#!/usr/bin/env bun
/**
 * Download.ts - Download files from OneDrive or SharePoint to local storage
 *
 * Usage:
 *   bun Download.ts --item-id <id> [options]
 *
 * Options:
 *   --item-id <id>       Required. The file's unique ID from MS365
 *   --filename <name>    Local filename (auto-detected if not provided)
 *   --output <dir>       Output directory (default: ~/WORK/scratch/)
 *   --site-id <id>       SharePoint site ID (for SharePoint files)
 *   --drive-id <id>      Drive ID (required for SharePoint)
 *   --overwrite          Overwrite if file exists
 *   --help               Show this help
 *
 * Examples:
 *   bun Download.ts --item-id abc123
 *   bun Download.ts --item-id abc123 --output ~/Downloads/
 *   bun Download.ts --item-id abc123 --site-id site456 --drive-id drive789
 *
 * @author PAI System
 * @version 1.0.0
 */

import { existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { $ } from 'bun';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

const USER_ID = 'sfoley@buxtonco.com';
const DEFAULT_OUTPUT = join(process.env.HOME || '', 'WORK', 'scratch');

interface DownloadOptions {
  itemId: string;
  filename?: string;
  output: string;
  siteId?: string;
  driveId?: string;
  overwrite: boolean;
}

function printHelp(): void {
  console.log(`${colors.bold}Download.ts${colors.reset} - Download files from OneDrive/SharePoint

${colors.cyan}Usage:${colors.reset}
  bun Download.ts --item-id <id> [options]

${colors.cyan}Options:${colors.reset}
  --item-id <id>       ${colors.dim}Required. The file's unique ID from MS365${colors.reset}
  --filename <name>    ${colors.dim}Local filename (auto-detected if not provided)${colors.reset}
  --output <dir>       ${colors.dim}Output directory (default: ~/WORK/scratch/)${colors.reset}
  --site-id <id>       ${colors.dim}SharePoint site ID (for SharePoint files)${colors.reset}
  --drive-id <id>      ${colors.dim}Drive ID (required for SharePoint)${colors.reset}
  --overwrite          ${colors.dim}Overwrite if file exists${colors.reset}
  --help               ${colors.dim}Show this help${colors.reset}

${colors.cyan}Examples:${colors.reset}
  ${colors.dim}# Download from OneDrive${colors.reset}
  bun Download.ts --item-id abc123

  ${colors.dim}# Download to specific location${colors.reset}
  bun Download.ts --item-id abc123 --output ~/Downloads/

  ${colors.dim}# Download from SharePoint${colors.reset}
  bun Download.ts --item-id abc123 --site-id site456 --drive-id drive789

  ${colors.dim}# Download with custom name${colors.reset}
  bun Download.ts --item-id abc123 --filename report.xlsx
`);
}

function parseArgs(args: string[]): DownloadOptions | null {
  const options: DownloadOptions = {
    itemId: '',
    output: DEFAULT_OUTPUT,
    overwrite: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        return null;
      case '--item-id':
        options.itemId = next || '';
        i++;
        break;
      case '--filename':
        options.filename = next || '';
        i++;
        break;
      case '--output':
        options.output = next?.replace('~', process.env.HOME || '') || DEFAULT_OUTPUT;
        i++;
        break;
      case '--site-id':
        options.siteId = next || '';
        i++;
        break;
      case '--drive-id':
        options.driveId = next || '';
        i++;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
    }
  }

  return options;
}

async function getFileInfo(options: DownloadOptions): Promise<{ name: string; size: number } | null> {
  try {
    let cmd: string;

    if (options.siteId && options.driveId) {
      // SharePoint file
      cmd = `Get-MgSiteDriveItem -SiteId '${options.siteId}' -DriveId '${options.driveId}' -DriveItemId '${options.itemId}' | Select-Object Name, Size | ConvertTo-Json`;
    } else {
      // OneDrive file
      cmd = `Get-MgUserDriveItem -UserId '${USER_ID}' -DriveItemId '${options.itemId}' | Select-Object Name, Size | ConvertTo-Json`;
    }

    const result = await $`auth-keeper ms365 ${cmd}`.text();
    const info = JSON.parse(result.trim());
    return { name: info.Name, size: info.Size };
  } catch (error) {
    console.error(`${colors.red}Failed to get file info:${colors.reset}`, error);
    return null;
  }
}

async function downloadFile(options: DownloadOptions, filename: string): Promise<boolean> {
  const outputPath = join(options.output, filename);

  // Ensure output directory exists
  if (!existsSync(options.output)) {
    mkdirSync(options.output, { recursive: true });
    console.log(`${colors.dim}Created directory: ${options.output}${colors.reset}`);
  }

  // Check if file exists
  if (existsSync(outputPath) && !options.overwrite) {
    console.error(`${colors.yellow}File already exists: ${outputPath}${colors.reset}`);
    console.log(`${colors.dim}Use --overwrite to replace${colors.reset}`);
    return false;
  }

  try {
    let cmd: string;

    if (options.siteId && options.driveId) {
      // SharePoint download
      cmd = `Get-MgSiteDriveItemContent -SiteId '${options.siteId}' -DriveId '${options.driveId}' -DriveItemId '${options.itemId}' -OutFile '${outputPath}'`;
    } else {
      // OneDrive download
      cmd = `Get-MgUserDriveItemContent -UserId '${USER_ID}' -DriveItemId '${options.itemId}' -OutFile '${outputPath}'`;
    }

    console.log(`${colors.cyan}Downloading...${colors.reset}`);
    await $`auth-keeper ms365 ${cmd}`;
    return true;
  } catch (error) {
    console.error(`${colors.red}Download failed:${colors.reset}`, error);
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args);
  if (!options) {
    process.exit(0);
  }

  // Validate required options
  if (!options.itemId) {
    console.error(`${colors.red}Error: --item-id is required${colors.reset}`);
    process.exit(1);
  }

  if (options.siteId && !options.driveId) {
    console.error(`${colors.red}Error: --drive-id is required when using --site-id${colors.reset}`);
    process.exit(1);
  }

  // Get file info
  console.log(`${colors.blue}Fetching file info...${colors.reset}`);
  const fileInfo = await getFileInfo(options);

  if (!fileInfo) {
    console.error(`${colors.red}Could not get file information. Check that the item ID is correct.${colors.reset}`);
    process.exit(1);
  }

  const filename = options.filename || fileInfo.name;
  console.log(`${colors.dim}File: ${fileInfo.name} (${formatSize(fileInfo.size)})${colors.reset}`);

  // Download
  const success = await downloadFile(options, filename);

  if (success) {
    const outputPath = join(options.output, filename);
    console.log(`${colors.green}${colors.bold}Downloaded:${colors.reset} ${outputPath}`);
    console.log(`${colors.dim}Size: ${formatSize(fileInfo.size)}${colors.reset}`);
  } else {
    process.exit(1);
  }
}

main();
