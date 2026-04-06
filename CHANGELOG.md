# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
