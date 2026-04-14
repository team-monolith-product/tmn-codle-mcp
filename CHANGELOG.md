# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-04-14

### Added

- 마크다운 이미지 크기 지정 문법 `![alt](src =WIDTHxHEIGHT)` 지원. `=400x300` (width+height) 또는 `=600` (width만, height는 자동) 형식으로 CDS ImageNode의 크기를 설정할 수 있다. 크기 미지정 시 기존 동작(0=inherit) 유지.

### Fixed

- AI 에이전트가 `!`를 `\!`로 이스케이프하여 전달할 때 이미지 regex 매칭이 실패하던 문제 수정 (`resolveLocalImages`, IMAGE transformer)
- `buildSelectBlock`/`buildInputBlock`에서 퀴즈·주관식 문제 본문(`questionText`)을 plain text로 처리하여 이미지 등 block-level 마크다운이 렌더링되지 않던 문제 수정 — `convertFromMarkdown`으로 파싱하도록 변경

## [1.3.1] - 2026-04-14

### Fixed

- `problem create` — descriptive 문제 생성 시 `criteria` 미지정이어도 `descriptive_criterium` 레코드를 기본값(`input_size: 200`, `high_ratio: 1.0`, `mid_ratio: 0.7`, `low_ratio: 0.3`)으로 항상 생성하도록 수정. FE 에디터에서 null 참조 버그 방지.

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
