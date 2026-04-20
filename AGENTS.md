# AGENTS.md. 팀모노리스

> **목적** – 이 파일은 이 레포지토리에서 작업하는 모든 AI(Claude, Cursor, GPT, 등) 와 개발자를 위한 온보딩 매뉴얼입니다.
> 우리의 코딩 표준, 가드 레일, 그리고 업무 절차 기술을 담고 있으며 30% (설계, 테스트, 도메인 판단) 의 영역은 여전히 인간 개발자의 몫으로 남겨둡니다.

---

## 0. 개요

Codle CLI는 oclif 기반 CLI로, AI 에이전트(Claude Code)가 bash에서 `codle <command>`를 호출하여 Codle API를 조작한다. 자료(Material), 활동(Activity), 문제(Problem), 태그(Tag) 등의 리소스를 관리한다.

---

## 1. 타협 불가능한 규칙

| #   | AI _may_ do                                                                                                               | AI _must NOT_ do                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-0 | Whenever unsure about something that's related to the project, ask the developer for clarification before making changes. | ❌ Write changes or use tools when you are not sure about something project specific, or if you don't have context for a particular feature/decision. |
| G-1 | Add/update **`AIDEV-NOTE:` anchor comments** when the _why_ is non-obvious from code alone.                               | ❌ Delete or mangle existing `AIDEV-` comments. ❌ Restate what code already expresses.                                                               |
| G-2 | Follow lint/style configs. Use the project's configured linter/formatter.                                                 | ❌ Re-format code to any other style.                                                                                                                 |
| G-3 | For changes >300 LOC or >3 files, **ask for confirmation**.                                                               | ❌ Refactor large modules without human guidance.                                                                                                     |
| G-4 | Stay within the current task context. Inform the dev if it'd be better to start afresh.                                   | ❌ Continue work from a prior prompt after "new task" – start a fresh session.                                                                        |

---

## 2. Build, test & utility commands

```bash
npm run build                # TypeScript 빌드
npm test                     # vitest 단위 테스트
npm run typecheck            # tsc --noEmit 타입 체크
npm run e2e                  # vitest E2E 테스트 (Claude Code 기반)
```

### Push 전 필수 검증 (변경된 파일 대상)

```bash
# 1. 타입 체크 (프로젝트 전체)
npm run typecheck

# 2. 변경과 관련된 테스트 실행
npx vitest run --reporter=verbose $(git diff --name-only --diff-filter=d origin/main...HEAD -- 'tests/')
```

### PR 생성 전 / PR 수정 후 필수 검증 (전체)

PR을 생성하거나 리뷰 피드백 반영 후 반드시 아래 전체 검증을 수행하여 통과해야 한다.

```bash
# 1. TypeScript 빌드
npm run build

# 2. 전체 단위 테스트
npm test

# 3. 타입 체크
npm run typecheck

# 4. E2E 검증 (영향 TC, haiku, repeats=1, 실패 시 재시도 2회)
bash scripts/run-e2e.sh

# 5. E2E 리포트 (영향 TC, haiku→sonnet→opus, repeats=7)
bash scripts/run-e2e.sh --report
```

### E2E 테스트

E2E 테스트는 Claude Code를 통해 CLI를 실행하고 결과를 검증하는 방식이다. 테스트는 `e2e/tests/{command}/{subcommand}.test.ts` 구조로 구성된다. 작성 원칙과 컨벤션은 `e2e/README.md`를 참고한다.

```bash
# 단일 실행
E2E_MODEL=haiku E2E_REPEATS=1 npm run e2e

# 스크립트 사용 (영향 TC 자동 선별)
bash scripts/run-e2e.sh             # Phase 1: 검증 (haiku, repeats=1)
bash scripts/run-e2e.sh --report    # Phase 2: 리포트 (3모델, repeats=7)
```

### PR 작성 시 참고

- `e2e/.stats.md`의 내용을 PR 본문의 E2E 섹션에 포함한다.

---

## 3. 코딩 표준

### 설계 원칙

- **API 계약 준수**: `/api/v1/*` 엔드포인트만 사용. `/admin/v1/*`은 절대 사용 불가.
- **인증**: `codle auth login`으로 OAuth 로그인. 토큰은 `~/.config/codle/`에 암호화 저장, 401 시 자동 갱신.
- **컨텍스트 절약**: command description에 중복·내부 구현 정보를 넣지 않는다.

### 수정 원칙

- **소스코드 기반 수정**: API 계약이 불확실할 때 반드시 Rails/React 소스를 확인한 뒤 수정한다.
  - Rails 백엔드: `jce-class-rails` (controller, serializer, routes, filter 등)
  - React 프론트엔드: `jce-codle-react` (API 호출 패턴, 파라미터 형식 등)
- **trial-and-error 금지**: 추측으로 코드를 수정하고 API를 찔러보는 식의 반복을 하지 않는다. 소스를 읽고 정확한 원인을 파악한 뒤 한 번에 수정한다.

### 버전 관리

- `package.json`의 `version`을 직접 수정하지 않는다.
- PR이 main에 머지되면 release workflow가 PR 제목의 type에 따라 자동으로 버전을 올린다.
  - `feat:` → minor bump
  - `fix:`, `perf:` → patch bump
  - 그 외 (`chore:`, `docs:`, `ci:` 등) → 버전 변경 없음

---

## 4. Anchor comments

비직관적인 코드에 `AIDEV-NOTE:` 앵커 코멘트를 남긴다.

- 기존 `AIDEV-*` 코멘트를 삭제하지 않는다.
- 연관 코드 수정 시 해당 앵커도 함께 업데이트한다.
- 코드만 보고 이해할 수 없는 경우에만 사용한다. 단순 동작 설명이나 기획 재작성 용도가 아니다.
- 적절한 사용: 비직관적 구현, 기술적 차선책, 인지된 기술 부채, 외부 제약으로 인한 우회

---

## 5. Commit discipline

- **Granular commits**: One logical change per commit.
- **Tag AI-generated commits**: e.g., `feat: optimise feed query [AI]`.
- **Clear commit messages**: Explain the _why_; link to issues/TASK if architectural.
- **Prefer merge over rebase**: `git merge origin/main`을 사용한다. `git rebase`는 사용하지 않는다.
- **Review AI-generated code**: Never merge code you don't understand.
