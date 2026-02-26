# Codle MCP Server (TypeScript)

## 기술 스택

- Runtime: Node.js 22+
- MCP SDK: `@modelcontextprotocol/sdk`
- HTTP: native `fetch`
- Validation: `zod`
- Test: `vitest`
- Build: `tsc` (ESM, Node16 module)

## 명령어

- `npm run build` — TypeScript 빌드 (dist/)
- `npm test` — 전체 테스트
- `npm run typecheck` — 타입 체크만

## 구조

```
src/
├── index.ts          # Entry point (stdio transport)
├── server.ts         # McpServer 인스턴스 + instructions
├── config.ts         # 환경변수 (dotenv)
├── logger.ts         # stderr 로깅
├── api/
│   ├── client.ts     # CodleClient (fetch, OAuth2, retry)
│   ├── models.ts     # JSON:API 유틸
│   └── errors.ts     # CodleAPIError
└── tools/
    ├── register.ts   # 모든 tool 일괄 등록
    ├── activities.ts
    ├── materials.ts
    ├── problems.ts
    ├── bundles.ts
    └── tags.ts
```

## API 제약사항

- **api/v1만 사용**: `/api/v1/*` 엔드포인트만 사용. `/admin/v1/*`은 절대 사용 불가.
- **ProblemCollection**: 직접 생성 불가 (POST 엔드포인트 없음). Activity 생성 시 Rails가 자동 생성.

## 수정 원칙

- **소스코드 기반 수정**: API 계약이 불확실할 때 반드시 Rails/React 소스를 확인한 뒤 수정한다.
  - Rails 백엔드: `jce-class-rails` (controller, serializer, routes, filter 등)
  - React 프론트엔드: `jce-codle-react` (API 호출 패턴, 파라미터 형식 등)
- **trial-and-error 금지**: 추측으로 코드를 수정하고 API를 찔러보는 식의 반복을 하지 않는다.
  소스를 읽고 정확한 원인을 파악한 뒤 한 번에 수정한다.
