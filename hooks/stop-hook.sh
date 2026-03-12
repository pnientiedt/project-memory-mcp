#!/bin/bash
# Ralph Wiggum Loop Controller
# Checks exit conditions and signals loop termination
#
# Called as a Claude Code stop hook to evaluate whether the session
# should continue or terminate based on promise markers in the transcript.
#
# Exit codes:
#   0 - Continue the loop (no exit condition met)
#   1 - Stop the loop (exit condition detected)

RALPH_DIR=".ralph"
STATUS_FILE="$RALPH_DIR/status.json"

# Ensure ralph directory exists
mkdir -p "$RALPH_DIR"

# Read the transcript from stdin (Claude Code passes it as JSON)
TRANSCRIPT=$(cat)

# Initialize status if not present
if [ ! -f "$STATUS_FILE" ]; then
    echo '{"iterations": 0, "status": "running", "last_promise": ""}' > "$STATUS_FILE"
fi

# Increment iteration counter
ITERATIONS=$(jq -r '.iterations' "$STATUS_FILE" 2>/dev/null || echo 0)
ITERATIONS=$((ITERATIONS + 1))

# Check for RALPH_STATUS markers in transcript
check_marker() {
    local marker="$1"
    echo "$TRANSCRIPT" | grep -q "$marker"
}

# Determine exit condition
EXIT_STATUS="running"
LAST_PROMISE=""

if check_marker "RALPH_STATUS=COMPLETE"; then
    EXIT_STATUS="complete"
    LAST_PROMISE="COMPLETE"
elif check_marker "RALPH_STATUS=BLOCKED"; then
    EXIT_STATUS="blocked"
    LAST_PROMISE="BLOCKED"
fi

# Read config for max iterations
MAX_ITERATIONS=50
if [ -f "$RALPH_DIR/config.yaml" ]; then
    CONFIG_MAX=$(grep "^max_iterations:" "$RALPH_DIR/config.yaml" | awk '{print $2}' 2>/dev/null)
    if [ -n "$CONFIG_MAX" ] && [ "$CONFIG_MAX" -gt 0 ] 2>/dev/null; then
        MAX_ITERATIONS=$CONFIG_MAX
    fi
fi

# Check max iterations
if [ "$ITERATIONS" -ge "$MAX_ITERATIONS" ]; then
    EXIT_STATUS="max_iterations"
fi

# Update status file
jq -n \
    --argjson iterations "$ITERATIONS" \
    --arg status "$EXIT_STATUS" \
    --arg last_promise "$LAST_PROMISE" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{iterations: $iterations, status: $status, last_promise: $last_promise, timestamp: $timestamp}' \
    > "$STATUS_FILE"

# Output status for loop controller
echo "{\"status\": \"$EXIT_STATUS\", \"iterations\": $ITERATIONS}"

# Exit 0 to continue, 1 to stop
case "$EXIT_STATUS" in
    complete|blocked|stuck|max_iterations)
        exit 1
        ;;
    *)
        exit 0
        ;;
esac
