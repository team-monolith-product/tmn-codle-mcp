---
name: e2e-report
description: Run MCP e2e tests and post stats to PR comment
allowed-tools: Bash(npm:*), Bash(gh:*), Bash(git:*), Read
---

# E2E Report Command

MCP E2E 테스트를 실행하고, 결과 통계를 PR 코멘트로 포스팅한다.

## 실행 단계

1. **E2E 테스트 실행**: `E2E_REPEATS=3 npm run e2e` 실행 (timeout 30분).
2. **결과 파일 읽기**: `e2e/.stats.md` 파일을 Read 도구로 읽는다.
3. **현재 브랜치 확인**: `git branch --show-current` 실행.
4. **PR 확인**: `gh pr list --head {branch} --json number --jq '.[0].number'` 로 PR 번호 확인.
5. **PR 코멘트 포스팅**:
   - PR이 있으면 → `gh pr comment {number} --body-file e2e/.stats.md`
   - PR이 없으면 → 사용자에게 "PR이 없습니다" 안내 후 콘솔 출력만 표시.
6. **PR 본문 체크리스트 업데이트** (PR이 있을 때만):
   - `gh pr view {number} --json body --jq '.body'` 로 본문을 확인한다.
   - `- [ ]` (미체크) 상태인 `/e2e-report` 관련 항목이 있으면 `- [x]`로 변경한다.
   - `gh pr edit {number} --body {updated_body}` 로 본문을 업데이트한다.
   - 이미 체크되어 있으면 아무것도 하지 않는다.

## 주의 사항

- E2E 테스트가 실패하더라도 `.stats.md`는 생성된다. 실패 시 사용자에게 알린다.
- `e2e/.stats.md`는 `.gitignore`에 포함되어 있으므로 커밋하지 않는다.
