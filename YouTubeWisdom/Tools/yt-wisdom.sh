#!/usr/bin/env bash
# yt-wisdom.sh - Extract wisdom from YouTube videos using Apify + fabric
set -euo pipefail

WISDOM_DIR="/data/home/notes/wisdom"
DEFAULT_PATTERN="extract_wisdom"

usage() {
    echo "Usage: yt-wisdom.sh <youtube-url> [pattern] [--stdout]"
    echo ""
    echo "Arguments:"
    echo "  youtube-url    YouTube video URL"
    echo "  pattern        fabric pattern (default: extract_wisdom)"
    echo "  --stdout       Print to stdout instead of saving to file"
    exit 1
}

# Parse arguments
[[ $# -lt 1 ]] && usage
URL="$1"
PATTERN="${2:-$DEFAULT_PATTERN}"
STDOUT=false
[[ "${3:-}" == "--stdout" || "${2:-}" == "--stdout" ]] && STDOUT=true
[[ "${2:-}" == "--stdout" ]] && PATTERN="$DEFAULT_PATTERN"

# Extract video ID from URL
VIDEO_ID=$(echo "$URL" | sed -n 's/.*[?&]v=\([^&]*\).*/\1/p')
[[ -z "$VIDEO_ID" ]] && VIDEO_ID=$(echo "$URL" | sed -n 's/.*youtu\.be\/\([^?]*\).*/\1/p')
[[ -z "$VIDEO_ID" ]] && { echo "Error: Could not extract video ID from URL"; exit 1; }

# Get Apify token from BWS
source ~/repos/github.com/sethdf/imladris/scripts/bws-init.sh 2>/dev/null || true
APIFY_TOKEN=$(bws_get apify-api-token 2>/dev/null) || {
    echo "Error: Could not get apify-api-token from BWS"
    exit 1
}

echo "Fetching transcript for video: $VIDEO_ID..." >&2

# Call Apify to get transcript
APIFY_RESPONSE=$(curl -s --fail "https://api.apify.com/v2/acts/scrape-creators~best-youtube-transcripts-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"videoUrls\":[\"https://www.youtube.com/watch?v=$VIDEO_ID\"]}")

# Extract transcript and title
TRANSCRIPT=$(echo "$APIFY_RESPONSE" | jq -r '.[0].transcript_only_text // empty')
TITLE=$(echo "$APIFY_RESPONSE" | jq -r '.[0].title // "untitled"' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-50)

[[ -z "$TRANSCRIPT" ]] && { echo "Error: Could not fetch transcript"; exit 1; }

echo "Running fabric pattern: $PATTERN..." >&2

# Run fabric
RESULT=$(echo "$TRANSCRIPT" | fabric -p "$PATTERN")

if $STDOUT; then
    echo "$RESULT"
else
    # Save to wisdom folder
    mkdir -p "$WISDOM_DIR"
    DATE=$(date +%Y-%m-%d)
    OUTFILE="$WISDOM_DIR/$DATE-$TITLE.md"

    cat > "$OUTFILE" << EOF
---
source: $URL
title: "$(echo "$APIFY_RESPONSE" | jq -r '.[0].title // "Untitled"')"
date: $DATE
---

$RESULT
EOF

    echo "Saved to: $OUTFILE" >&2
    echo "$OUTFILE"
fi
