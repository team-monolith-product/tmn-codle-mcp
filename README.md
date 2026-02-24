# Codle MCP Server

사내 이용자(고객팀, 컨텐츠팀)를 위한 Codle MCP 서버.
Claude Desktop/Code에서 자연어로 Codle 자료를 조회/생성/수정할 수 있다.

> 설치/설정 가이드: [SETUP.md](SETUP.md)

## 아키텍처

```
Claude Desktop/Code
  └─ MCP Protocol (stdio)
       └─ codle-mcp (이 서버)
            └─ HTTP (JSON:API)
                 └─ jce-class-rails (/api/v1/*)
                      └─ user-rails (토큰 검증)
```

### 인증 흐름

`/api/v1/*` 엔드포인트는 `authorize_user_token!`을 사용한다.

1. MCP 서버가 `Authorization: Bearer <token>` 헤더로 요청
2. class-rails가 user-rails `/api/v1/me`로 원격 검증 (로컬 JWT 검증 아님)
3. user-rails가 Doorkeeper DB에서 opaque 토큰 조회 → 유효하면 사용자 정보 반환
4. class-rails가 결과를 5분간 캐시

| 엔드포인트 | 인증 방식 | MCP 사용 |
|---|---|---|
| `/api/v1/materials` | `authorize_user_token!` | O |
| `/api/v1/activities` | `authorize_user_token!` | O |
| `/api/v1/problems` | `authorize_user_token!` | O |
| `/api/v1/material_bundles` | `authorize_user_token!` | O |
| `/api/v1/tags` | 인증 없음 (public) | O |
| 인프라 엔드포인트 | `authorize_api_token!` (rails_super_key) | X |

### 토큰 특성

- **타입**: Opaque (JWT 아님) — Doorkeeper DB에 저장된 랜덤 문자열
- **수명**: 교사 120분, 학생 30분
- **갱신**: refresh_token 지원 (`POST /oauth/token`, `grant_type=refresh_token`)
- **발급**: `authorization_code`, `implicit`, `password` grant 지원
- `rails_super_key`는 인프라 엔드포인트 전용이라 콘텐츠 API에는 사용 불가

## TODO

### 인증 자동화

현재는 수동으로 Bearer 토큰을 설정해야 하며, 만료 시 재설정 필요.

**향후 자동화 옵션:**
- **Password Grant 자동 인증**: `config.py`에 username/password/oauth_url 추가, `client.py`에 토큰 발급/갱신 로직 (~80-100줄)
- **Refresh Token 갱신**: `config.py`에 refresh_token 추가, `client.py`에 401 → refresh 로직 (~40-50줄)

- [ ] 토큰 자동 발급/갱신 (Password Grant 또는 Refresh Token)
- [ ] 환경별(dev/prod) 설정 분리

### API 클라이언트
- [ ] bulk API 지원 (create_many, update_many) - materials, problems, tags
- [ ] 에러 응답 파싱 개선 (JSON:API errors 포맷)
- [ ] 요청 재시도 (retry) 로직
- [ ] 페이지네이션 자동 처리 (전체 결과 조회)

### Tool 개선
- [ ] tool description 튜닝 (LLM tool 선택 정확도 향상)
- [ ] 검색 필터 파라미터 확장 (ransack 쿼리 활용)
- [ ] 자료 생성 시 활동까지 한번에 생성하는 복합 tool 검토
- [ ] 문제 생성 시 test_case, problem_answer 포함 지원

### 테스트
- [ ] dev 환경 실제 API 연동 테스트
- [ ] tool별 단위 테스트 (mock API)
- [ ] Claude Desktop 연동 E2E 테스트

### 배포/운영
- [ ] Docker 이미지 빌드
- [ ] 사내 배포 방안 (팀원 onboarding)
