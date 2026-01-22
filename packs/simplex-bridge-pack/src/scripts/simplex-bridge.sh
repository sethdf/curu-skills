#!/usr/bin/env bash
# simplex-bridge.sh - Mobile AI interface via SimpleX Chat
# Listens for SimpleX messages, routes through Haiku, executes via Claude Code
set -euo pipefail

# Configuration
SIMPLEX_CLI="${SIMPLEX_CLI:-$HOME/.local/bin/simplex-chat}"
CONFIG_FILE="${SIMPLEX_BRIDGE_CONFIG:-$HOME/.config/simplex-bridge/config.yaml}"
LOG_DIR="${SIMPLEX_BRIDGE_LOG_DIR:-$HOME/inbox/simplex}"
CLAUDE_CMD="${CLAUDE_CMD:-claude}"
HAIKU_MODEL="claude-3-5-haiku-latest"
LIST_SESSIONS_TOOL="$HOME/.claude/skills/WhereWasI/Tools/ListSessions.ts"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

# Check dependencies
check_deps() {
    local missing=()

    if [[ ! -x "$SIMPLEX_CLI" ]]; then
        missing+=("simplex-chat CLI at $SIMPLEX_CLI")
    fi

    if ! command -v "$CLAUDE_CMD" &>/dev/null; then
        missing+=("claude CLI")
    fi

    if ! command -v jq &>/dev/null; then
        missing+=("jq")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies:"
        for dep in "${missing[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        log "Loading config from $CONFIG_FILE"
        # Parse YAML config (basic parsing, could use yq for complex configs)
        WORK_ROOTS=$(grep -A10 'work:' "$CONFIG_FILE" 2>/dev/null | grep -E '^\s+-' | sed 's/.*- //' | tr '\n' ':' || echo "")
        HOME_ROOTS=$(grep -A10 'home:' "$CONFIG_FILE" 2>/dev/null | grep -E '^\s+-' | sed 's/.*- //' | tr '\n' ':' || echo "")
    else
        log "No config file found, using defaults"
        WORK_ROOTS="$HOME/repos/work/:$HOME/work/"
        HOME_ROOTS="$HOME/repos/personal/:$HOME/projects/"
    fi
}

# Detect context using Haiku
detect_context() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M')
    local day_of_week=$(date '+%A')
    local hour=$(date '+%H')

    # Build context detection prompt
    local prompt="Analyze this message and determine the appropriate routing context.

Message: \"$message\"
Current time: $timestamp ($day_of_week)
Hour: $hour (24h format)

Determine:
1. CONTEXT: 'work' or 'home' (based on content, time of day, day of week)
2. SKILL: If message starts with / or clearly requests a specific skill (calendar, mail, slack, telegram, signal, comms), extract it. Otherwise 'none'.
3. PROJECT: If message references a specific project name, extract it. Otherwise 'none'.

Respond ONLY with JSON in this exact format:
{\"context\": \"work\", \"skill\": \"none\", \"project\": \"none\"}

Rules:
- Work hours are Mon-Fri 9am-6pm
- Explicit skill invocations like '/calendar' should be detected
- Project names might be mentioned explicitly
- Default to 'home' for personal/casual messages
- Default to 'work' for professional/technical messages during work hours"

    # Call Haiku for routing decision
    local response
    response=$(echo "$prompt" | "$CLAUDE_CMD" --model "$HAIKU_MODEL" -p 2>/dev/null || echo '{"context": "home", "skill": "none", "project": "none"}')

    # Extract JSON from response (in case there's extra text)
    echo "$response" | grep -o '{[^}]*}' | head -1
}

# Execute request via Claude Code
execute_request() {
    local message="$1"
    local context="$2"
    local skill="$3"
    local project="$4"

    local cmd_args=()

    # Add context
    cmd_args+=(--context "$context")

    # If skill detected, prepend to message
    local final_message="$message"
    if [[ "$skill" != "none" && ! "$message" =~ ^/ ]]; then
        final_message="/$skill $message"
    fi

    # Add project context if detected
    if [[ "$project" != "none" ]]; then
        # Try to find project directory
        local project_dir
        project_dir=$(find $HOME/repos -maxdepth 3 -type d -name "$project" 2>/dev/null | head -1)
        if [[ -n "$project_dir" ]]; then
            cmd_args+=(--cwd "$project_dir")
        fi
    fi

    log "Executing: $CLAUDE_CMD ${cmd_args[*]} -p \"$final_message\""

    # Execute and capture response
    local response
    response=$("$CLAUDE_CMD" "${cmd_args[@]}" -p "$final_message" 2>&1) || true

    echo "$response"
}

# Send response via SimpleX
send_simplex_response() {
    local contact="$1"
    local response="$2"

    # Truncate very long responses for mobile readability
    if [[ ${#response} -gt 4000 ]]; then
        response="${response:0:3900}

... (truncated, ${#response} chars total)"
    fi

    # Send via simplex-chat
    "$SIMPLEX_CLI" "@$contact $response" 2>/dev/null || log_error "Failed to send response"
}

# Log conversation
log_conversation() {
    local timestamp="$1"
    local sender="$2"
    local message="$3"
    local response="$4"
    local context="$5"

    local log_file="$LOG_DIR/$(date '+%Y-%m-%d').md"

    {
        echo ""
        echo "## $timestamp"
        echo ""
        echo "**From:** $sender"
        echo "**Context:** $context"
        echo ""
        echo "**Message:**"
        echo "$message"
        echo ""
        echo "**Response:**"
        echo "$response"
        echo ""
        echo "---"
    } >> "$log_file"
}

# Format sessions for mobile display
format_sessions_mobile() {
    local json="$1"
    local count="${2:-5}"

    # Parse JSON and format for mobile
    echo "$json" | jq -r --argjson count "$count" '. as $sessions | if length == 0 then "No recent sessions found." else "Recent Sessions:\n" + ($sessions[:$count] | to_entries | map("\(.key + 1). [\(.value.age)] \(.value.title)" + (if .value.status == "COMPLETED" then " [done]" else " [open]" end)) | join("\n")) + (if length > $count then "\n\n(\(length - $count) more...)" else "" end) end'
}

# Handle sessions/wherewasi request directly (fast path)
handle_sessions_request() {
    local days="${1:-7}"

    if [[ ! -f "$LIST_SESSIONS_TOOL" ]]; then
        echo "Sessions tool not found. Install WhereWasI skill."
        return 1
    fi

    local sessions_json
    sessions_json=$(bun "$LIST_SESSIONS_TOOL" --format json --days "$days" 2>/dev/null)

    if [[ -z "$sessions_json" || "$sessions_json" == "[]" ]]; then
        echo "No sessions found in last $days days."
        return 0
    fi

    format_sessions_mobile "$sessions_json" 5
}

# Check if message is a sessions request
is_sessions_request() {
    local message="$1"
    local lower_msg=$(echo "$message" | tr '[:upper:]' '[:lower:]')

    [[ "$lower_msg" =~ ^(sessions|wherewasi|/wherewasi|where\ was\ i|what\ was\ i\ working\ on|resume|recent\ sessions) ]]
}

# Process incoming message
process_message() {
    local sender="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    log "Processing message from $sender: ${message:0:50}..."

    # Fast path: Handle sessions/wherewasi requests directly
    if is_sessions_request "$message"; then
        log "Fast path: Sessions request detected"
        local response
        response=$(handle_sessions_request 7)
        send_simplex_response "$sender" "$response"
        log_conversation "$timestamp" "$sender" "$message" "$response" "sessions"
        log_success "Sessions request handled (fast path)"
        return
    fi

    # Detect context
    local routing_json
    routing_json=$(detect_context "$message")

    local context skill project
    context=$(echo "$routing_json" | jq -r '.context // "home"')
    skill=$(echo "$routing_json" | jq -r '.skill // "none"')
    project=$(echo "$routing_json" | jq -r '.project // "none"')

    log "Routing: context=$context, skill=$skill, project=$project"

    # Execute request
    local response
    response=$(execute_request "$message" "$context" "$skill" "$project")

    # Send response
    send_simplex_response "$sender" "$response"

    # Log conversation
    log_conversation "$timestamp" "$sender" "$message" "$response" "$context"

    log_success "Processed message from $sender"
}

# Parse SimpleX message output
# SimpleX CLI outputs messages in a specific format
parse_simplex_output() {
    local line="$1"

    # Example format: @contact: message text
    if [[ "$line" =~ ^@([^:]+):\ (.+)$ ]]; then
        local sender="${BASH_REMATCH[1]}"
        local message="${BASH_REMATCH[2]}"

        # Skip our own messages (responses)
        if [[ "$sender" == "self" ]]; then
            return
        fi

        process_message "$sender" "$message"
    fi
}

# Main listener loop
listen() {
    log "Starting SimpleX Bridge listener..."
    log "Log directory: $LOG_DIR"
    log "Press Ctrl+C to stop"

    # Start simplex-chat in listen mode
    # Note: simplex-chat API may vary - this is a conceptual implementation
    "$SIMPLEX_CLI" 2>&1 | while IFS= read -r line; do
        # Skip empty lines and system messages
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        # Check if it's a new message
        if [[ "$line" =~ ^@ ]]; then
            parse_simplex_output "$line"
        fi
    done
}

# Status check
status() {
    log "SimpleX Bridge Status"
    echo ""
    echo "Configuration:"
    echo "  CLI: $SIMPLEX_CLI"
    echo "  Config: $CONFIG_FILE"
    echo "  Log dir: $LOG_DIR"
    echo ""
    echo "Dependencies:"
    if [[ -x "$SIMPLEX_CLI" ]]; then
        echo "  ✓ simplex-chat: $($SIMPLEX_CLI --version 2>/dev/null || echo 'installed')"
    else
        echo "  ✗ simplex-chat: not found at $SIMPLEX_CLI"
    fi
    if command -v "$CLAUDE_CMD" &>/dev/null; then
        echo "  ✓ claude: $($CLAUDE_CMD --version 2>&1 | head -1)"
    else
        echo "  ✗ claude: not found"
    fi
    if command -v jq &>/dev/null; then
        echo "  ✓ jq: $(jq --version)"
    else
        echo "  ✗ jq: not found"
    fi
}

# Test routing
test_routing() {
    local message="${1:-Whats on my calendar today?}"

    log "Testing routing for: $message"

    local routing_json
    routing_json=$(detect_context "$message")

    echo ""
    echo "Routing decision:"
    echo "$routing_json" | jq .
}

# Test sessions handler
test_sessions() {
    local days="${1:-7}"
    log "Testing sessions handler (last $days days)..."
    echo ""
    handle_sessions_request "$days"
}

# Main
main() {
    check_deps
    load_config

    case "${1:-listen}" in
        listen|start)
            listen
            ;;
        status)
            status
            ;;
        test)
            shift
            test_routing "$@"
            ;;
        sessions)
            shift
            test_sessions "$@"
            ;;
        *)
            echo "Usage: $0 {listen|status|test [message]|sessions [days]}"
            exit 1
            ;;
    esac
}

main "$@"
