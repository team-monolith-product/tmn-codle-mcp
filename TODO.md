# TASK-5507 남은 작업

## 보안 정리 (public 전환 전 필수)

- [ ] `.env.e2e.example` — OAuth Client ID를 placeholder로 교체
- [ ] `src/config.ts` — 내부 dev/e2e URL 제거 또는 환경변수 전용으로 변경
- [ ] `.github/workflows/*.yml` — ECR/K8s 경로 노출 허용 여부 판단
- [ ] E2E 테넌트 번호 하드코딩 제거

## E2E 테스트

- [ ] CLI 커맨드에 대한 e2e 테스트 추가

## README

- [ ] 비개발자 대상 설치 가이드 (`curl | bash`)
- [ ] CLI 사용법 문서 (주요 커맨드 예시)

## CI/CD

- [ ] CLI 빌드(`tsc`) 검증 step 추가
