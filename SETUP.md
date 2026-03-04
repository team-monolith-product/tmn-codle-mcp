# Codle MCP 설치 가이드

## MCP 클라이언트 설정

### Claude Code

프로젝트 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "codle": {
      "type": "http",
      "url": "https://mcp.codle.io/mcp",
      "headers": {
        "Authorization": "Bearer ${CODLE_TOKEN}"
      }
    }
  }
}
```

`CODLE_TOKEN` 환경변수에 토큰을 설정한다. 토큰 발급은 인프라팀에 문의.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`에 동일한 JSON을 추가한다.

## 사용 예시

설정 완료 후 Claude에게 자연어로 요청:

- "파이썬 기초 자료 검색해줘"
- "새 자료 만들어줘. 이름은 'React 입문'"
- "이 자료에 퀴즈 활동 추가해줘"

## 문제 해결

| 증상               | 원인           | 해결                                     |
| ------------------ | -------------- | ---------------------------------------- |
| 401 Unauthorized   | 토큰 누락/만료 | MCP 클라이언트의 Authorization 헤더 확인 |
| Connection refused | 서버 URL 오류  | `.mcp.json`의 URL 확인                   |

## 로컬 개발

`.env.example` 참고.
