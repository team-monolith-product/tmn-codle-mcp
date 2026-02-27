# Codle MCP Server

## 설계 원칙

- **인터페이스 우선**: MCP 도구의 이름, 파라미터, 반환값 설계를 구현보다 먼저 확정한다.
- **API 계약 준수**: `/api/v1/*` 엔드포인트만 사용. `/admin/v1/*`은 절대 사용 불가.
- **인증 흐름 유지**: per-request `Authorization: Bearer` 헤더 방식. 서버에 토큰을 저장하지 않는다.
- **컨텍스트 절약**: server instructions와 tool description에 중복·내부 구현 정보를 넣지 않는다. AI 에이전트가 소비하는 토큰을 최소화한다.

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
