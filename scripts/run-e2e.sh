#!/bin/bash
set -euo pipefail

# E2E 테스트 실행 스크립트
#
# Usage:
#   bash scripts/run-e2e.sh             # Phase 1: 검증 (haiku, repeats=1, 영향 TC만)
#   bash scripts/run-e2e.sh --report    # Phase 2: 리포트 (haiku→sonnet→opus, repeats=7, 영향 TC만)

REPORT_MODE=false
if [[ "${1:-}" == "--report" ]]; then
  REPORT_MODE=true
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# --- 환경 설정 ---
[ ! -f .env.e2e ] && cp .env.e2e.example .env.e2e

# --- 빌드 ---
npm run build

# --- 영향 TC 선별 ---
# e2e 테스트 파일명은 src/commands/ 디렉토리명과 동일한 컨벤션 (kebab-case)
# 예: src/commands/material/ → e2e/tests/material.test.ts

CHANGED_FILES=$(git diff origin/main --name-only 2>/dev/null || true)

RUN_ALL=false
AFFECTED_TESTS=()

if [ -z "$CHANGED_FILES" ]; then
  RUN_ALL=true
else
  while IFS= read -r file; do
    # 공유 코드 변경 → 전체 실행
    if [[ "$file" =~ ^src/(lib|auth|utils)/ ]] || \
       [[ "$file" =~ ^e2e/(lib|fixtures)/ ]] || \
       [[ "$file" =~ ^e2e/global-setup\.ts$ ]] || \
       [[ "$file" =~ ^e2e/vitest\.config\.ts$ ]]; then
      RUN_ALL=true
      break
    fi

    # src/commands/{cmd}/ → e2e/tests/{cmd}/ 디렉토리 내 모든 테스트
    if [[ "$file" =~ ^src/commands/([^/]+)/ ]]; then
      cmd="${BASH_REMATCH[1]}"
      if [ -d "e2e/tests/${cmd}" ]; then
        for tf in e2e/tests/${cmd}/*.test.ts; do
          [ -f "$tf" ] && AFFECTED_TESTS+=("$tf")
        done
      fi
    fi

    # 새로 추가/수정된 e2e 테스트 파일
    if [[ "$file" =~ ^e2e/tests/.*\.test\.ts$ ]] && [ -f "$file" ]; then
      AFFECTED_TESTS+=("$file")
    fi
  done <<< "$CHANGED_FILES"
fi

# 테스트 파일 결정
if $RUN_ALL; then
  echo "[run-e2e] Running all e2e tests."
  TEST_FILES=""
else
  if [ ${#AFFECTED_TESTS[@]} -gt 0 ]; then
    TEST_FILES=$(printf '%s\n' "${AFFECTED_TESTS[@]}" | sort -u | tr '\n' ' ')
  else
    echo "[run-e2e] No affected e2e tests found. Skipping."
    exit 0
  fi
  echo "[run-e2e] Affected tests: $TEST_FILES"
fi

# --- 테스트 실행 ---
run_tests() {
  local model="$1"
  local repeats="$2"
  shift 2
  local extra_args="${*:-}"

  echo "[run-e2e] model=$model, repeats=$repeats"

  if [ -n "$TEST_FILES" ]; then
    E2E_MODEL="$model" E2E_REPEATS="$repeats" npm run e2e -- $extra_args $TEST_FILES
  else
    E2E_MODEL="$model" E2E_REPEATS="$repeats" npm run e2e ${extra_args:+-- $extra_args}
  fi
}

if $REPORT_MODE; then
  MODELS=(haiku sonnet opus)

  for model in "${MODELS[@]}"; do
    echo ""
    echo "=============================="
    echo "[run-e2e] Report: model=$model, repeats=7"
    echo "=============================="

    run_tests "$model" 7 || true
    [ -f "e2e/.stats.md" ] && cp "e2e/.stats.md" "e2e/.stats-${model}.md"
  done

  # 모델별 결과 병합
  : > "e2e/.stats.md"
  for model in "${MODELS[@]}"; do
    if [ -f "e2e/.stats-${model}.md" ]; then
      cat "e2e/.stats-${model}.md" >> "e2e/.stats.md"
      echo "" >> "e2e/.stats.md"
    fi
  done

  echo ""
  echo "[run-e2e] Report complete. Results: e2e/.stats.md"
else
  # 실패한 테스트만 최대 2회 재시도 (AI 비결정성 대응)
  run_tests haiku 1 --retry 2
fi
