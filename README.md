# Codle MCP Server

사내 이용자(고객팀, 컨텐츠팀)를 위한 Codle MCP 서버.
Claude Desktop/Code에서 자연어로 Codle 자료를 조회/생성/수정할 수 있다.

> 설치/설정 가이드: [SETUP.md](SETUP.md)

## 아키텍처

```
Claude Desktop/Code
  └─ MCP Protocol (Streamable HTTP)
       └─ codle-mcp (이 서버, Node.js)
            └─ HTTP/fetch (JSON:API)
                 └─ jce-class-rails (/api/v1/*)
                      └─ user-rails (토큰 검증)
```

### 엔드포인트별 인증 (Rails 소스 기준)

| 엔드포인트           | 인증 방식               | MCP 사용 |
| -------------------- | ----------------------- | -------- |
| `/api/v1/materials`  | `authorize_user_token!` | O        |
| `/api/v1/activities` | `authorize_user_token!` | O        |
| `/api/v1/tags`       | 인증 없음 (public)      | O        |

## 디버깅

Claude Code에서는 stderr가 MCP 서버 로그 파일로 리다이렉트된다:

```bash
# Claude Code MCP 로그 위치
tail -f ~/.claude/logs/mcp-server-codle.log
```

Claude Desktop은 `~/Library/Logs/Claude/` 하위에서 확인할 수 있다.
