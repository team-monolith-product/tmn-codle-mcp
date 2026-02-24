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

```
1. MCP 서버 시작 (토큰 없음)
2. 첫 API 요청 시 password grant로 토큰 자동 발급
   POST user-rails/oauth/token (email + password + client_id)
   → access_token + refresh_token
3. class-rails에 Bearer 토큰으로 요청
4. class-rails → user-rails /api/v1/me로 원격 검증 (5분 캐시)
5. 토큰 만료 시 (401) → refresh_token으로 갱신, 실패 시 재인증
```

| 엔드포인트 | 인증 방식 | MCP 사용 |
|---|---|---|
| `/api/v1/materials` | `authorize_user_token!` | O |
| `/api/v1/activities` | `authorize_user_token!` | O |
| `/api/v1/problems` | `authorize_user_token!` | O |
| `/api/v1/material_bundles` | `authorize_user_token!` | O |
| `/api/v1/tags` | 인증 없음 (public) | O |

### 토큰 특성

- **타입**: Opaque (JWT 아님) — Doorkeeper DB 저장
- **수명**: 교사 120분, 학생 30분
- **갱신**: refresh_token (만료 없음, Redis 활동 기록 필요)
- **발급**: password grant (user-rails Doorkeeper)

## TODO

### 인증

- [x] Password Grant 자동 인증 (email/password → 토큰 발급, 401 시 refresh → 재인증)
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
