# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-09

### Added

- `problem create/update`, `material create/update`, `activitiable update` — markdown 본문(`--content`, `--commentary`, `--body`, `--goals`)의 로컬 이미지(`![](file:///abs/path.png)`)를 ActiveStorage Direct Upload로 자동 업로드 후 blob redirect URL로 치환. 로컬 파일은 `file://` URL로만 전달 가능하며, `http(s)://`는 pass-through, 그 외 모든 입력(raw 절대 경로, 상대 경로, `data:`, `mailto:` 등)은 에러로 거절된다.

## [1.2.0] - 2026-04-06

### Added

- `activity create` — QuizActivity 생성 시 `--is-exam` / `--no-is-exam` 옵션 추가
- `activitiable update` — QuizActivity 유형 지원 추가 (`--is-exam` 옵션)

## [1.1.0] - 2026-03-30

### Added

- `activity set-flow` — `--append` 플래그 추가 (기존 흐름 유지하며 추가)

### Fixed

- `--append` 모드에서 기존 transition 중복 pair 제거
- `--append` 전체 중복 시 불필요한 API 호출 방지
