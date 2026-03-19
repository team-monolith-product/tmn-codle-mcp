# Codle CLI

## 아키텍처

oclif 기반 CLI 도구. 비즈니스 로직은 services/에 집중하고, commands/는 thin wrapper.

```
src/
├── services/       # 비즈니스 로직
├── commands/       # oclif CLI commands → services 호출
├── api/            # CodleClient (생성자 토큰 주입)
└── base-command.ts # CLI base command
```

### 인증

`--token` 플래그 또는 `CODLE_TOKEN` 환경변수 → `CodleClient` 생성자에 직접 주입.

### 설치

```bash
curl -fsSL https://raw.githubusercontent.com/team-monolith-product/tmn-codle-mcp/main/install.sh | bash
```

## 설계 원칙

- **서비스 레이어 분리**: commands/는 thin wrapper. 비즈니스 로직은 services/에 집중.
- **API 계약 준수**: `/api/v1/*` 엔드포인트만 사용. `/admin/v1/*`은 절대 사용 불가.
- **출력 포맷**: `--output text` (기본) 또는 `--output json`. service 함수는 `{ data, text }` 형태로 반환.

## 수정 원칙

- **소스코드 기반 수정**: API 계약이 불확실할 때 반드시 Rails/React 소스를 확인한 뒤 수정한다.
  - Rails 백엔드: `jce-class-rails` (controller, serializer, routes, filter 등)
  - React 프론트엔드: `jce-codle-react` (API 호출 패턴, 파라미터 형식 등)
- **trial-and-error 금지**: 추측으로 코드를 수정하고 API를 찔러보는 식의 반복을 하지 않는다.
  소스를 읽고 정확한 원인을 파악한 뒤 한 번에 수정한다.

## Anchor Comments

비직관적인 코드에 `AIDEV-NOTE:` 앵커 코멘트를 남긴다.

- 기존 `AIDEV-*` 코멘트를 삭제하지 않는다.
- 연관 코드 수정 시 해당 앵커도 함께 업데이트한다.
- 코드만 보고 이해할 수 없는 경우에만 사용한다. 단순 동작 설명이나 기획 재작성 용도가 아니다.
- 적절한 사용: 비직관적 구현, 기술적 차선책, 인지된 기술 부채, 외부 제약으로 인한 우회
