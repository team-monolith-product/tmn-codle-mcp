# Codle CLI

## 아키텍처

oclif 기반 CLI. AI 에이전트(Claude Code)가 bash로 `codle <command>` 를 호출하여 Codle API를 조작한다.

```
src/
├── base-command.ts          # 공통 플래그(--token, --api-url, --output), CodleClient 생성, 에러 핸들링
├── commands/                # oclif 커맨드 (비즈니스 로직 직접 포함)
│   ├── material/            # 자료 CRUD + 검색
│   ├── activity/            # 활동 CRUD + 코스흐름/갈림길
│   ├── activitiable/        # activitiable 속성 업데이트 (Board, Sheet, Embedded, Video)
│   ├── problem/             # 문제 CRUD + collection sync
│   ├── tag/                 # 태그 검색
│   ├── docs/                # 문서 출력
│   └── html-activity-page/  # 교안 페이지 sync
├── api/
│   ├── client.ts            # CodleClient (REST fetch wrapper)
│   ├── models.ts            # JSON:API 헬퍼
│   └── errors.ts            # CodleAPIError
├── lexical/                 # Markdown → Lexical JSON 변환
├── config.ts                # 환경 변수 설정
└── logger.ts                # stderr 로거
```

## 설계 원칙

- **API 계약 준수**: `/api/v1/*` 엔드포인트만 사용. `/admin/v1/*`은 절대 사용 불가.
- **인증**: `--token` 플래그 또는 `CODLE_TOKEN` 환경변수로 Bearer 토큰 전달.
- **컨텍스트 절약**: command description에 중복·내부 구현 정보를 넣지 않는다.

## 수정 원칙

- **소스코드 기반 수정**: API 계약이 불확실할 때 반드시 Rails/React 소스를 확인한 뒤 수정한다.
  - Rails 백엔드: `jce-class-rails` (controller, serializer, routes, filter 등)
  - React 프론트엔드: `jce-codle-react` (API 호출 패턴, 파라미터 형식 등)
- **trial-and-error 금지**: 추측으로 코드를 수정하고 API를 찔러보는 식의 반복을 하지 않는다.
  소스를 읽고 정확한 원인을 파악한 뒤 한 번에 수정한다.

## Anchor Comments

비직관적인 코드에 `AIDEV-NOTE:` 앵커 코멘트를 남긴다.

- 기존 `AIDEV-*` 코멘트를 삭제하지 않는다.
- 연관 코드 수정 시 해당 앵커도 함께 업데이트한다.
- 코드만 보고 이해할 수 없는 경우에만 사용한다. 단순 동작 설명이나 기획 재작성 용도가 아니다.
- 적절한 사용: 비직관적 구현, 기술적 차선책, 인지된 기술 부채, 외부 제약으로 인한 우회
