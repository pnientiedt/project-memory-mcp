#!/bin/bash
# CI/CD Entry Point for Headless Execution
# Runs a Claude Code agent in headless mode for autonomous task execution.
#
# Usage: ./scripts/run-headless.sh [options] <prompt-or-task>
# Example: ./scripts/run-headless.sh "Execute Beads epic bd-abc123"
#
# Required environment variables:
#   ANTHROPIC_API_KEY  - Anthropic API key for Claude
#
# Optional environment variables:
#   MAX_ITERATIONS     - Maximum loop iterations (default: 50)
#   TIMEOUT_MINUTES    - Session timeout in minutes (default: 60)
#   PERMISSION_MODE    - Claude permission mode (default: bypassPermissions)

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RALPH_DIR="$PROJECT_ROOT/.ralph"
LOG_DIR="$RALPH_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/session_${TIMESTAMP}.log"

# Defaults
MAX_ITERATIONS="${MAX_ITERATIONS:-50}"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-60}"
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1" | tee -a "$LOG_FILE"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR${NC} $1" | tee -a "$LOG_FILE"; }

show_help() {
    cat << EOF
Usage: $(basename "$0") [options] "<prompt>"

Run a Claude Code agent in headless mode for autonomous task execution.

Arguments:
    prompt              Task prompt or instruction for the agent

Options:
    -n, --max-iterations    Maximum iterations (default: $MAX_ITERATIONS)
    -t, --timeout           Timeout in minutes (default: $TIMEOUT_MINUTES)
    -p, --permission-mode   Claude permission mode (default: $PERMISSION_MODE)
    -h, --help              Show this help message

Environment Variables:
    ANTHROPIC_API_KEY   Required. Anthropic API key.
    MAX_ITERATIONS      Override max iterations.
    TIMEOUT_MINUTES     Override timeout.
    PERMISSION_MODE     Override permission mode.

Examples:
    $(basename "$0") "Execute Beads epic bd-abc123"
    $(basename "$0") -n 100 "Fix all P1 bugs in the backlog"
    $(basename "$0") -t 120 "Perform comprehensive security review"

Exit Codes:
    0 - Task completed successfully
    1 - Task failed or max iterations reached
    2 - Blocked (human intervention required)
    3 - Stuck (no progress detected)
    10 - Configuration error
EOF
}

# Parse arguments
PROMPT=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT_MINUTES="$2"
            shift 2
            ;;
        -p|--permission-mode)
            PERMISSION_MODE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            PROMPT="$1"
            shift
            ;;
    esac
done

# Validate
if [ -z "$PROMPT" ]; then
    log_err "No prompt provided"
    show_help
    exit 10
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log_err "ANTHROPIC_API_KEY environment variable is required"
    exit 10
fi

if ! command -v claude &> /dev/null; then
    log_err "claude CLI not found. Install Claude Code: https://claude.ai/code"
    exit 10
fi

# Setup
mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

log "Starting headless session"
log "Max iterations: $MAX_ITERATIONS"
log "Timeout: ${TIMEOUT_MINUTES}m"
log "Log file: $LOG_FILE"
log "Prompt: $PROMPT"

# Write config for stop hook
mkdir -p "$RALPH_DIR"
cat > "$RALPH_DIR/config.yaml" << EOF
max_iterations: $MAX_ITERATIONS
timeout_minutes: $TIMEOUT_MINUTES
heartbeat_interval_seconds: 30
exit_on_complete: true
exit_on_blocked: true
max_stuck_iterations: 5
EOF

# Run Claude in headless mode
ITERATION=1
EXIT_CODE=0

while [ "$ITERATION" -le "$MAX_ITERATIONS" ]; do
    log "Iteration $ITERATION / $MAX_ITERATIONS"

    OUTPUT_FILE=$(mktemp)

    timeout "${TIMEOUT_MINUTES}m" claude \
        --print \
        --permission-mode "$PERMISSION_MODE" \
        --output-format text \
        "$PROMPT" 2>&1 | tee "$OUTPUT_FILE" | tee -a "$LOG_FILE"

    # Check exit conditions
    if grep -q "RALPH_STATUS=COMPLETE" "$OUTPUT_FILE" 2>/dev/null; then
        log_ok "Task completed successfully after $ITERATION iterations"
        rm -f "$OUTPUT_FILE"
        EXIT_CODE=0
        break
    fi

    if grep -q "RALPH_STATUS=BLOCKED" "$OUTPUT_FILE" 2>/dev/null; then
        log_warn "Agent blocked after $ITERATION iterations. Human intervention required."
        rm -f "$OUTPUT_FILE"
        EXIT_CODE=2
        break
    fi

    rm -f "$OUTPUT_FILE"
    ITERATION=$((ITERATION + 1))

    # Brief pause between iterations
    sleep 2
done

if [ "$ITERATION" -gt "$MAX_ITERATIONS" ]; then
    log_warn "Max iterations ($MAX_ITERATIONS) reached without completion"
    EXIT_CODE=1
fi

log "Session ended with exit code: $EXIT_CODE"
log "Full log: $LOG_FILE"
exit $EXIT_CODE
