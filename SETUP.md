# Codle MCP 설치 가이드

## 요구사항

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (권장) 또는 pip

## 설치

```bash
uv pip install -e .
```

## 토큰 발급

MCP 서버는 Codle API 호출 시 사용자의 OAuth2 토큰이 필요하다.
토큰은 교사 계정 기준 **120분** 후 만료되므로, 만료 시 재설정해야 한다.

### 토큰 얻는 법

1. 브라우저에서 [dev-class.codle.io](https://class.dev.codle.io) 로그인
2. DevTools 열기 (F12)
3. Network 탭 → 아무 API 요청 클릭 → Request Headers에서 `Authorization` 값 복사
4. `Bearer eyABC123...` 형태의 전체 문자열을 사용

## Claude Code 설정

프로젝트 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "codle": {
      "command": "codle-mcp",
      "env": {
        "CODLE_API_URL": "https://class.dev.codle.io",
        "CODLE_TOKEN": "Bearer eyABC123..."
      }
    }
  }
}
```

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codle": {
      "command": "codle-mcp",
      "env": {
        "CODLE_API_URL": "https://class.dev.codle.io",
        "CODLE_TOKEN": "Bearer eyABC123..."
      }
    }
  }
}
```

> `codle-mcp`가 PATH에 없으면 절대경로를 사용한다. (예: `~/.local/bin/codle-mcp`)

## 사용 예시

설정 완료 후 Claude에게 자연어로 요청:

- "파이썬 기초 자료 검색해줘"
- "새 자료 만들어줘. 이름은 'React 입문'"
- "이 자료에 퀴즈 활동 추가해줘"
- "judge 타입 문제 목록 보여줘"

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 401 Unauthorized | 토큰 만료 | 새 토큰 발급 후 재설정 |
| Connection refused | API URL 오류 | `CODLE_API_URL` 확인 |
| Tool not found | 설치 안 됨 | `which codle-mcp` 확인 |
