#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RESULT_DIR="$SCRIPT_DIR/results/$TIMESTAMP"
MAX_BUDGET="${MAX_BUDGET:-1.00}"

mkdir -p "$RESULT_DIR"

# Inject timestamp into prompt
PROMPT="$(sed "s/__TIMESTAMP__/$TIMESTAMP/g" "$SCRIPT_DIR/prompt.md")"

echo "=== Codle MCP E2E Test ==="
echo "Timestamp: $TIMESTAMP"
echo "Budget:    \$$MAX_BUDGET"
echo "Results:   $RESULT_DIR"
echo "========================="

cd "$PROJECT_DIR"

# Allow running inside an existing Claude Code session
unset CLAUDECODE

claude -p "$PROMPT" \
    --output-format stream-json \
    --verbose \
    --mcp-config e2e/mcp-config.json \
    --strict-mcp-config \
    --allowed-tools "mcp__codle__*" \
    --max-budget-usd "$MAX_BUDGET" \
    --no-session-persistence \
    --model sonnet \
    > "$RESULT_DIR/raw.ndjson" 2> "$RESULT_DIR/stderr.log"

echo ""
echo "Raw output saved to $RESULT_DIR/raw.ndjson"
echo "Stderr log saved to $RESULT_DIR/stderr.log"

# Generate report
bash "$SCRIPT_DIR/parse-result.sh" "$RESULT_DIR"
