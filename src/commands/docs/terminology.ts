import { Command } from "@oclif/core";

// AIDEV-NOTE: 용어 매핑을 CLI 커맨드로 제공한다.
// AI 에이전트가 필요할 때 `codle docs terminology`로 참조한다.
const TERMINOLOGY_DOC = `# Codle 용어 매핑

Codle는 인터랙티브 학습 플랫폼입니다.

## 서비스 용어 → 개발 용어

| 서비스 용어 | 개발 용어 |
|---|---|
| 코스, 자료 | Material |
| 활동 | Activity |
| 태그 | Tag |
| 갈림길 | ActivityTransition (with level) |
| 코스 흐름 | ActivityTransition (linear) |

## 활동 유형 (Activity 접미사 생략 가능)

| 서비스 용어 | activity-type 값 |
|---|---|
| 퀴즈 | Quiz |
| 교안 | Html |
| 생성형 교안 | GenerativeHtml |
| 코딩 | Studio |
| 보드 | Board |
| 활동지 | Sheet |
| 영상 | Video |
| 엔트리 | Entry |
| 스크래치 | Scratch |
| PDF | Pdf |
| 외부 URL | Embedded |
| 메이크코드 | Makecode |
| 코댑 | Codap |
| 소크룸 | Socroom |
| AI 추천 퀴즈 | AiRecommendQuiz |
`;

export default class DocsTerminology extends Command {
  static description =
    "Codle 플랫폼 용어 매핑 가이드를 출력합니다. 서비스 용어와 개발 용어의 대응 관계를 확인할 수 있습니다.";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  async run(): Promise<void> {
    this.log(JSON.stringify({ content: TERMINOLOGY_DOC }));
  }
}
