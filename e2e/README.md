# E2E 테스트

Claude Code를 MCP 클라이언트로 사용하여 Codle MCP 서버의 전체 도구를 자동 검증한다.

## 구조

```
e2e/
├── run.js              # 실행 스크립트 (서버 기동 → 유저/토큰 발급 → 테스트 → 리포트 → 정리)
├── prompt.md           # Claude에게 보낼 테스트 시나리오 (12 steps)
├── mcp-config.json     # dev 환경 직접 테스트용 (run.js에서는 미사용)
└── results/
    └── YYYYMMDD_HHMMSS/
        ├── raw.ndjson   # Claude 출력 (stream-json)
        ├── stderr.log
        └── report.md    # 파싱된 리포트
```

## 사전 준비

```bash
cp .env.e2e.example .env.e2e
```

`.env.e2e`에 다음 값을 설정한다:

| 변수 | 설명 |
|------|------|
| `E2E_TENANT_NUMBER` | E2E 테넌트 번호 (기본 17) |
| `E2E_USER_CLIENT_ID` | Doorkeeper OAuth Application의 client_id |

```bash
npm run build
```

## 실행

```bash
npm run e2e

# 예산 조정 (기본 $1.00)
MAX_BUDGET=2.00 npm run e2e
```

## 결과 확인

실행 완료 후 터미널에 Quick Summary가 출력된다. 상세 리포트는 `e2e/results/<timestamp>/report.md`에서 확인한다.

## dev 환경 직접 테스트

로컬 서버 없이 dev 환경(`mcp.dev.codle.io`)을 직접 테스트하려면 `mcp-config.json`을 사용한다:

```bash
claude -p "$(cat e2e/prompt.md)" \
  --mcp-config e2e/mcp-config.json \
  --strict-mcp-config \
  --allowed-tools "mcp__codle__*" \
  --model sonnet
```
