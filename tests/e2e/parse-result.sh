#!/usr/bin/env bash
set -euo pipefail

RESULT_DIR="${1:?Usage: parse-result.sh <result-dir>}"
RAW="$RESULT_DIR/raw.ndjson"
REPORT="$RESULT_DIR/report.md"

if [ ! -f "$RAW" ]; then
    echo "ERROR: $RAW not found"
    exit 1
fi

# Extract final result stats
COST=$(jq -r 'select(.type == "result") | .cost_usd // "N/A"' "$RAW" | tail -1)
INPUT_TOKENS=$(jq -r 'select(.type == "result") | .input_tokens // "N/A"' "$RAW" | tail -1)
OUTPUT_TOKENS=$(jq -r 'select(.type == "result") | .output_tokens // "N/A"' "$RAW" | tail -1)
DURATION=$(jq -r 'select(.type == "result") | .duration_ms // "N/A"' "$RAW" | tail -1)
TURNS=$(jq -r 'select(.type == "result") | .num_turns // "N/A"' "$RAW" | tail -1)

# Extract tool calls in order
TOOL_CALLS=$(jq -r '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "tool_use") |
  .name
' "$RAW")

TOOL_COUNT=$(echo "$TOOL_CALLS" | grep -c . || true)

# Extract MCP init status
MCP_STATUS=$(jq -r '
  select(.subtype == "init") |
  .mcp_servers // empty |
  to_entries[] |
  "\(.key): \(.value.status // "unknown")"
' "$RAW" 2>/dev/null || echo "N/A")

# Extract final text output (the test report from Claude)
FINAL_TEXT=$(jq -r '
  select(.type == "result") |
  .result // empty
' "$RAW" | tail -1)

# Build report
cat > "$REPORT" << HEADER
# Codle MCP E2E Test Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Result Dir:** $RESULT_DIR

## Execution Stats

| Metric | Value |
|--------|-------|
| Cost | \$$COST |
| Input Tokens | $INPUT_TOKENS |
| Output Tokens | $OUTPUT_TOKENS |
| Duration (ms) | $DURATION |
| Turns | $TURNS |
| Tool Calls | $TOOL_COUNT |

## MCP Connection

\`\`\`
$MCP_STATUS
\`\`\`

## Tool Call Sequence

\`\`\`
$(echo "$TOOL_CALLS" | nl -ba)
\`\`\`

## Test Results

$FINAL_TEXT
HEADER

echo ""
echo "=== Report generated: $REPORT ==="
echo ""
echo "--- Quick Summary ---"
echo "Cost:       \$$COST"
echo "Tokens:     $INPUT_TOKENS in / $OUTPUT_TOKENS out"
echo "Duration:   ${DURATION}ms"
echo "Tool Calls: $TOOL_COUNT"
echo "---"
