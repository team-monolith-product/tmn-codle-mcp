# 이번 작업 리뷰 문서

## MCP → CLI 전환 PR 선제 체크리스트

기존 병합된 PR 리뷰 패턴을 분석하여 도출한 체크리스트.

### [컨텍스트 격리 / 토큰 관리]

- CLI help/description에 내부 구현 세부사항이 노출되지 않는가?
- 커맨드 간 설명이 중복되지 않는가?
- 불필요한 내부 동작 설명이 포함되어 있지 않은가?

### [인터페이스 설계]

- Stateful한 워크플로우 강제가 없는가? (생성과 연결이 독립 커맨드로 분리되었는가?)
- 파라미터에 enum/선택지 제약이 스키마 수준에서 걸려 있는가?
- 존재하지 않는 커맨드/도구를 참조하는 description이 없는가?
- 범위 외 파라미터가 섞여 있지 않은가? (별도 커맨드로 분리해야 할 것이 없는가?)

### [TypeScript 타입 안전성]

- `""` 기본값 대신 null/undefined를 사용하는가?
- 진입점에서 인증 검증이 이루어지는가? (깊은 레이어까지 흘리지 않는가?)
- 각 모듈의 책임이 단일한가? (config에서 URL 정규화 등 하지 않는가?)

### [Dead Code / 구현-문서 일치]

- MCP 시절 코드의 잔재가 남아있지 않은가?
- 테스트가 실제 구현과 일치하는가? (mock이 실제 API 시그니처와 동일한지)
- 문서(README, CLAUDE.md)가 현재 CLI 구현을 정확히 반영하는가?
- 이전 PR에서 지적되었으나 미해결된 이슈가 이월되지 않았는가?

### [안전성]

- 비가역적 동작에 대한 방어 전략이 있는가?

### [리뷰 가능성]

- 리뷰어가 실험 없이도 동작을 검증할 수 있는 근거(E2E 결과 등)가 제시되는가?

## 리뷰 사항

### 목록

- [x] docs/sheet-directives — token 불필요한데 required → `Command` 직접 상속으로 변경
- [ ] activity/create — step-2 실패 시 orphaned activitiable → 수정 안 함 (pre-existing, PR 범위 외)
- [x] AIDEV-NOTE 4건 truncation — 멀티라인 주석의 일부 라인 누락 → 원본 대비 복원 완료
- [x] tag/search domain — 유효하지 않은 domain 입력 시 silent failure → oclif `options`로 스키마 수준 검증
- [x] logger prefix — codle_mcp: MCP 잔재 → `codle:`로 수정
- [ ] activity-type — oclif options 미적용 → 수정 안 함 (15타입+15축약=30개 options, help 오염. normalizeActivityType이 명확한 에러 제공)
- [x] problem/collection/sync.ts AIDEV-NOTE 3줄→1줄 축약 → 3줄 복원
- [x] problem/create.ts AIDEV-NOTE 2줄→1줄 축약 → 2줄 복원
- [x] problem/update.ts AIDEV-NOTE blocks presence 2줄→1줄 축약 → 2줄 복원
- [x] docs/sheet-directives.ts가 BaseCommand 상속으로 --token 필수인데 API 호출 없음 → #1과 동일, `Command` 직접 상속
- [ ] activity/set-flow.ts, set-branch.ts에서 data_to_destroy를 조건부 포함 → 수정 안 함 (pre-existing 패턴, API가 양쪽 허용)
- [x] ensureAuth() dead code — constructor injection으로 절대 throw 불가 → 메서드 + 호출 제거

### 2차 리뷰 (2026-03-20T05:56)

- [x] problem/update.ts AIDEV-NOTE upsert 2줄째 누락 → 1차 수정 시 이미 복원 완료
- [x] problem/update.ts commentary 변환 AIDEV-NOTE 누락 → create.ts와 동일한 주석 추가

### 3차 리뷰 (2026-03-20T06:21)

- [x] activity/create.ts AIDEV-NOTE truncation → `activitiable update로 이관하지 않는다` 구문 복원
- [x] problem/update.ts commentary AIDEV-NOTE 누락 → 2차-2와 동일, 수정 완료

### 4차 리뷰

- [x] material/get.ts activitiable_id/activitiable_type 관계 데이터 누락 → relationships.activitiable.data에서 추출 로직 복원

### 5차 리뷰

- [x] problem/update.ts AIDEV-NOTE criteria 누락 → create.ts와 동일한 주석 추가
- [x] tag_ids 빈 배열 전달 불가 (material/update, activity/update) → `--tag-ids ""` 빈 문자열을 빈 배열로 변환하는 패턴 + AIDEV-NOTE
- [x] material/search.ts --is-public 설명이 구현 노출 → "공개 자료 검색 (미설정 시 내 자료)"로 간결화

### 처리 방침

- 하나하나를 비판적으로 판단할 것. 단순히 고치라고 해서 고치면 안됨.
- 해결하면서도 CLAUDE.md와 구현사항 그리고 상단의 체크리스트를 모두 만족하는 방향으로 개선할 수 있는지 고민할 것.
