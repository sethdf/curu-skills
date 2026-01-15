---
name: YouTubeWisdom
description: Extract wisdom from YouTube videos using Apify + fabric. USE WHEN user wants to analyze YouTube content, extract insights from videos, or save video wisdom. Invoke with /yt-wisdom.
allowed-tools:
  - Bash
  - Read
  - Write
---

# YouTubeWisdom

Extracts wisdom from YouTube videos by fetching transcripts via Apify and processing through fabric patterns.

## Quick Start

```bash
/yt-wisdom <youtube-url>              # Extract wisdom, save to notes
/yt-wisdom <youtube-url> summarize    # Use different pattern
/yt-wisdom <youtube-url> --stdout     # Print to stdout instead of saving
```

## How It Works

1. **Apify** fetches the transcript (bypasses YouTube bot detection)
2. **fabric** processes with extract_wisdom pattern (via Bedrock)
3. **Output** saved to `/data/home/notes/wisdom/` with date prefix

## Requirements

- `APIFY_API_TOKEN` in BWS (already configured)
- fabric configured with Bedrock (already done)

## Tool Usage

```bash
# Direct script usage
~/.claude/skills/YouTubeWisdom/Tools/yt-wisdom.sh <url> [pattern] [--stdout]

# Examples
yt-wisdom.sh "https://youtube.com/watch?v=abc123"
yt-wisdom.sh "https://youtube.com/watch?v=abc123" summarize
yt-wisdom.sh "https://youtube.com/watch?v=abc123" extract_wisdom --stdout
```

## Patterns

Common fabric patterns for video content:

| Pattern | Use Case |
|---------|----------|
| `extract_wisdom` | Key insights, quotes, recommendations (default) |
| `summarize` | Quick summary with main points |
| `extract_ideas` | Just the ideas |
| `create_summary` | Detailed summary |

## Output Location

Wisdom files saved to:
```
/data/home/notes/wisdom/YYYY-MM-DD-<video-title>.md
```

## Examples

**Example 1: Extract wisdom from a tech talk**
```
User: /yt-wisdom https://youtube.com/watch?v=G9S5DgmNBaM
-> Fetches transcript via Apify
-> Runs extract_wisdom pattern
-> Saves to /data/home/notes/wisdom/2024-01-15-claude-code-tips.md
```

**Example 2: Quick summary**
```
User: /yt-wisdom https://youtube.com/watch?v=abc123 summarize
-> Uses summarize pattern instead
```
