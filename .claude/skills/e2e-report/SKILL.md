---
name: e2e-report
description: Run CLI e2e tests and post stats to PR comment
allowed-tools: Bash(npm:*), Bash(gh:*), Bash(git:*), Read, Write
---

# E2E Report Command

CLI E2E 테스트를 실행하고, 결과 통계를 PR 코멘트로 포스팅한다.

## 실행 단계

1. **E2E 테스트 실행**: `E2E_REPEATS=7 npm run e2e` 실행 (timeout 30분).
2. **결과 파일 읽기**: `e2e/.stats.md` 파일을 Read 도구로 읽는다.
3. **결과 파일 재구성**: 아래 포맷에 따라 `e2e/.stats.md`를 재작성한다.
4. **현재 브랜치 확인**: `git branch --show-current` 실행.
5. **PR 확인**: `gh pr list --head {branch} --json number --jq '.[0].number'` 로 PR 번호 확인.
6. **PR 코멘트 포스팅**:
   - PR이 있으면 → `gh pr comment {number} --body-file e2e/.stats.md`
   - PR이 없으면 → 사용자에게 "PR이 없습니다" 안내 후 콘솔 출력만 표시.
7. **PR 본문 체크리스트 업데이트** (PR이 있을 때만):
   - `gh pr view {number} --json body --jq '.body'` 로 본문을 확인한다.
   - `- [ ]` (미체크) 상태인 `/e2e-report` 관련 항목이 있으면 `- [x]`로 변경한다.
   - `gh pr edit {number} --body {updated_body}` 로 본문을 업데이트한다.
   - 이미 체크되어 있으면 아무것도 하지 않는다.

## 결과 파일 포맷

`e2e/.stats.md`를 읽은 후, 아래 구조로 재작성한다.

### 판별 기준

- **PR 영향범위 TC**: PR에서 변경된 커맨드와 관련된 테스트 케이스. `git diff origin/main --name-only`로 변경 파일을 확인하고, 해당 도구의 e2e TC를 식별한다.
- **기존 테스트 (실패)**: PR 영향범위 외의 TC 중 pass rate가 100%가 아닌 것만 표시.

### 출력 포맷

```markdown
## E2E Stats (model: {model}, repeats: {n})

### PR 영향범위: {tool_name}

| Test                                    | Pass       | Cost | Time | Turns | Tools | Tokens (In/Out) |
| --------------------------------------- | ---------- | ---- | ---- | ----- | ----- | --------------- |
| {PR 영향범위 TC — 커맨드명 접두사 제거} | {pass}/{n} | ...  | ...  | ...   | ...   | ...             |

### 기존 테스트 (실패, {실패 TC 수}/{기존 TC 수})

| Test                       | Pass       | Cost | Time | Turns | Tools | Tokens (In/Out) |
| -------------------------- | ---------- | ---- | ---- | ----- | ----- | --------------- |
| {100% 아닌 기존 TC만 표시} | {pass}/{n} | ...  | ...  | ...   | ...   | ...             |

### Total

|           | Cost       | Time       | Tokens (In/Out) |
| --------- | ---------- | ---------- | --------------- |
| **TOTAL** | **{cost}** | **{time}** | **{tokens}**    |
```

- PR 영향범위 TC는 전부 표시 (pass/fail 무관).
- 기존 테스트는 실패한 것만 표시. 전부 통과하면 `기존 테스트 (실패, 0/{N})` 소제목만 남기고 표는 생략.
- Total 행은 원본 `.stats.md`의 TOTAL 값을 그대로 사용.

## 주의 사항

- E2E 테스트가 실패하더라도 `.stats.md`는 생성된다. 실패 시 사용자에게 알린다.
- `e2e/.stats.md`는 `.gitignore`에 포함되어 있으므로 커밋하지 않는다.
