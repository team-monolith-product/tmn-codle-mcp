# Codle CLI 설치 가이드

## 설치

```bash
curl -fsSL "https://raw.githubusercontent.com/team-monolith-product/tmn-codle-cli/main/install.sh" | bash
```

`~/.codle-cli/`에 설치되고, `~/.local/bin/codle`에 symlink가 생성된다.

## 인증

```bash
codle auth login
```

브라우저가 열리고 로그인하면 인증 완료. 토큰은 `~/.config/codle/credentials.json`에 암호화 저장되며, 만료 시 자동 갱신된다.

### API URL (선택)

기본값은 `https://class.codle.io`. 다른 환경을 사용하려면:

```bash
CODLE_API_URL="https://class.dev.codle.io" CODLE_AUTH_SERVER_URL="https://user.dev.codle.io" codle auth login
```

## 사용 예시

```bash
codle tag search 파이썬
codle material search --query "React"
codle material get 123
codle activity create --material-id 1 --name "퀴즈" --type Quiz
```

## 문제 해결

| 증상                       | 원인        | 해결                                   |
| -------------------------- | ----------- | -------------------------------------- |
| `command not found: codle` | PATH 미설정 | `export PATH="$HOME/.local/bin:$PATH"` |
| `인증 정보가 없습니다`     | 미로그인    | `codle auth login` 실행                |
| `API 에러 (401)`           | 세션 만료   | `codle auth login`으로 재로그인        |
| `API 에러 (404)`           | URL 오류    | `CODLE_API_URL` 확인                   |

## 업데이트

```bash
~/.codle-cli/install.sh
```

버전별 변경 내역은 [GitHub Releases](https://github.com/team-monolith-product/tmn-codle-cli/releases)에서 확인한다.
