# Codle MCP 설치 가이드

## 요구사항

- Node.js 22+

## 설치

```bash
npm install
npm run build
```

## 인증 설정

Codle 계정의 이메일/비밀번호로 자동 인증한다. 토큰 발급과 만료 시 갱신이 자동으로 처리된다.

필요한 정보:
- Codle 계정 이메일/비밀번호
- OAuth Client ID (`CODLE_REACT_APP_UID` 환경변수 값, 인프라팀에 문의)

## Claude Code 설정

프로젝트 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "codle": {
      "command": "node",
      "args": ["path/to/tmn-codle-mcp/dist/index.js"],
      "env": {
        "CODLE_API_URL": "https://class.dev.codle.io",
        "CODLE_AUTH_URL": "https://user.dev.codle.io",
        "CODLE_EMAIL": "teacher@example.com",
        "CODLE_PASSWORD": "your-password",
        "CODLE_CLIENT_ID": "your-client-id"
      }
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
| 인증 실패 | 잘못된 이메일/비밀번호/Client ID | 환경변수 확인 |
| Connection refused | API URL 오류 | `CODLE_API_URL`, `CODLE_AUTH_URL` 확인 |
| Cannot find module | 빌드 안 됨 | `npm run build` 실행 |
