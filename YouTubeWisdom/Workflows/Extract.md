# Extract Workflow

Extracts wisdom from a YouTube video using Apify transcript fetching and fabric pattern processing.

## Trigger

- "/yt-wisdom <url>"
- "extract wisdom from video"
- "analyze this YouTube video"

## Execution

1. **Parse Input**
   - Extract YouTube URL from user input
   - Optional: pattern name (default: extract_wisdom)
   - Optional: --stdout flag

2. **Fetch Transcript**
   ```bash
   ~/.claude/skills/YouTubeWisdom/Tools/YtWisdom.sh "<url>" [pattern] [--stdout]
   ```

3. **Process Output**
   - If --stdout: display results
   - Otherwise: save to `/data/home/notes/wisdom/YYYY-MM-DD-<title>.md`

4. **Report Results**
   - Confirm file location or show output
   - Include key insights preview

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| url | Yes | - | YouTube video URL |
| pattern | No | extract_wisdom | fabric pattern to use |
| --stdout | No | false | Print to stdout instead of saving |

## Example

```
User: /yt-wisdom https://youtube.com/watch?v=abc123
-> Runs YtWisdom.sh with URL
-> Saves wisdom to notes directory
-> Returns: "Wisdom extracted and saved to /data/home/notes/wisdom/2024-01-15-video-title.md"
```
