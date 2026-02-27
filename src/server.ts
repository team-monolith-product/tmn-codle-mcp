import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/register.js";

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

## 자료 생성 워크플로우

1. manage_tags로 태그 ID 조회
2. create_material
3. manage_activities(create)로 활동 생성 (순서 무관, 갈림길 포함)
4. set_activity_flow로 코스 흐름 설정
5. set_activity_branch로 갈림길 설정 (필요 시)
6. get_material_detail로 검증 (type "미연결" → activitiable 생성 실패, 재생성 필요)

## 주의사항

- 활동 삭제 시 transition 체인이 끊어짐. 복구 불가 → 자료 재생성이 안전.`,
};

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, SERVER_OPTIONS);
  registerAllTools(server);
  return server;
}
