# Contributing

개발자를 위한 가이드. 사용자 설치/설정은 [SETUP.md](SETUP.md) 참조.

## 개발 환경 설정

```bash
git clone https://github.com/team-monolith-product/tmn-codle-mcp.git
cd tmn-codle-mcp
npm ci
npm run build
```

## E2E 테스트

자연어 프롬프트 → CLI bash 호출 계약을 검증한다.
커맨드 인터페이스(flags, description, examples) 변경 시 실행.

```bash
cp .env.e2e.example .env.e2e
npm run e2e
```

> 상세 가이드: [e2e/README.md](e2e/README.md)

## 디버깅

```bash
CODLE_LOG_LEVEL=DEBUG codle tag search 파이썬 2>debug.log
```
