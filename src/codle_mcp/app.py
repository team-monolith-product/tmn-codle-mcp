from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "Codle",
    instructions="""Codle는 인터랙티브 학습 플랫폼입니다.
이 MCP 서버는 Codle의 자료, 문제, 활동, 시리즈, 태그 데이터를 조회하고 관리할 수 있는 도구를 제공합니다.

## 용어 매핑 (서비스 용어 = 개발 용어)

| 서비스 용어 | 개발 용어 | API 리소스 |
|---|---|---|
| 코스, 자료 | Material | materials |
| 시리즈, 번들 | MaterialBundle | material_bundles |
| 활동 | Activity | activities |
| 퀴즈 | QuizActivity | quiz_activities |
| 교안, 교안 실습 | HtmlActivity | html_activities |
| 코딩, Python | StudioActivity | studio_activities |
| 보드 | BoardActivity | board_activities |
| 활동지 | SheetActivity | sheet_activities |
| 영상 | VideoActivity | video_activities |
| 엔트리 | EntryActivity | entry_activities |
| 스크래치 | ScratchActivity | scratch_activities |
| PDF | PdfActivity | pdf_activities |
| 문제 | Problem | problems |
| 태그 | Tag | tags |
| 갈림길 | ActivityTransition (with level) | activity_transitions |
| 코스 흐름 | ActivityTransition (linear) | activity_transitions |

사용자가 "코스"라고 하면 Material, "시리즈"라고 하면 MaterialBundle을 의미합니다.
""",
)
