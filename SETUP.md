# Codle MCP 설치 가이드

## 요구사항

- Node.js 22+

## 설치

```bash
npm install
npm run build
```

## 서버 실행

```bash
node dist/index.js
```

기본 포트는 3000. `CODLE_PORT`로 변경 가능.

## 인증

서버는 환경변수로 토큰을 받지 않는다. MCP 클라이언트가 HTTP 요청 시 `Authorization: Bearer <token>` 헤더로 전달한다.

## Claude Code 설정

프로젝트 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "codle": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`에 동일한 JSON을 추가한다.

## 사용 예시

설정 완료 후 Claude에게 자연어로 요청:

- "파이썬 기초 자료 검색해줘"
- "새 자료 만들어줘. 이름은 'React 입문'"
- "이 자료에 퀴즈 활동 추가해줘"
- "judge 타입 문제 목록 보여줘"

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 401 Unauthorized | 토큰 누락/만료 | MCP 클라이언트의 Authorization 헤더 확인 |
| Connection refused | API URL 오류 | `CODLE_API_URL` 확인 |
| Cannot find module | 빌드 안 됨 | `npm run build` 실행 |
