import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/register.js";
import { registerAllResources } from "./resources/register.js";

const SERVER_INFO = {
  name: "Codle",
  version: "1.0.0",
};

const SERVER_OPTIONS = {
  instructions: `Codle는 인터랙티브 학습 플랫폼입니다.

## 용어 매핑

| 서비스 용어 | 개발 용어 |
|---|---|
| 코스, 자료 | Material |
| 활동 | Activity |
| 태그 | Tag |
| 갈림길 | ActivityTransition (with level) |
| 코스 흐름 | ActivityTransition (linear) |

활동 유형: 퀴즈=QuizActivity, 교안=HtmlActivity, 코딩=StudioActivity, 보드=BoardActivity, 활동지=SheetActivity, 영상=VideoActivity, 엔트리=EntryActivity, 스크래치=ScratchActivity, PDF=PdfActivity

## 콘텐츠 설정 워크플로우

1. 퀴즈/활동지: manage_problems로 문제 생성 → manage_problem_collection_problems로 활동에 연결
2. 보드 활동: update_activitiable로 안내문 설정 (content=markdown)
3. 활동지 설명: update_activitiable로 설명 설정 (content=markdown)
4. URL 활동: update_activitiable로 URL과 학습목표 설정 (url, goals)`,
};

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, SERVER_OPTIONS);
  registerAllTools(server);
  registerAllResources(server);
  return server;
}
