# Codle CLI 설치 가이드

## 설치

```bash
curl -fsSL "https://raw.githubusercontent.com/team-monolith-product/tmn-codle-mcp/main/install.sh" | bash
```

`~/.codle-cli/`에 설치되고, `~/.local/bin/codle`에 symlink가 생성된다.

## 설정

```bash
export CODLE_TOKEN="your-token"
```

토큰 발급은 인프라팀에 문의. `~/.bashrc` 또는 `~/.zshrc`에 추가하면 영구 설정.

### API URL (선택)

기본값은 `https://class.codle.io`. 다른 환경을 사용하려면:

```bash
export CODLE_API_URL="https://class.dev.codle.io"
```

## 사용 예시

```bash
codle tag search 파이썬
codle material search --query "React"
codle material get 123
codle activity create --material-id 1 --name "퀴즈" --type Quiz
```

## 문제 해결

| 증상                       | 원인           | 해결                                   |
| -------------------------- | -------------- | -------------------------------------- |
| `command not found: codle` | PATH 미설정    | `export PATH="$HOME/.local/bin:$PATH"` |
| `API 에러 (401)`           | 토큰 누락/만료 | `CODLE_TOKEN` 확인                     |
| `API 에러 (404)`           | URL 오류       | `CODLE_API_URL` 확인                   |

## 업데이트

```bash
~/.codle-cli/install.sh
```
