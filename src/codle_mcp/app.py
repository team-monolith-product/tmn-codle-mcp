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
| 문제 세트 | ProblemCollection | problem_collections |
| 태그 | Tag | tags |
| 갈림길 | ActivityTransition (with level) | activity_transitions |
| 코스 흐름 | ActivityTransition (linear) | activity_transitions |

사용자가 "코스"라고 하면 Material, "시리즈"라고 하면 MaterialBundle을 의미합니다.

## 자료 생성 전체 워크플로우

스크립트/교안으로 자료를 세팅할 때 아래 순서를 따르세요:

1. **태그 확인**: manage_tags로 필요한 태그 ID 조회
2. **시리즈 확인**: list_bundles/get_bundle_detail로 기존 시리즈 확인 (없으면 manage_bundle로 생성)
3. **자료 생성**: create_material (시리즈에 포함 시 material_bundle_id, position 지정)
4. **활동 순차 생성**: manage_activities(action="create")를 코스 흐름 순서대로 호출
   - 활동은 반드시 순서대로 생성 (자동 체이닝)
   - 갈림길 활동도 manage_activities로 생성 (branch_from 지정 → auto-chain 없이 활동만 생성)
   - 모든 갈림길 활동 생성 후 set_activity_branch로 분기 설정 (mid 필수, low/high 선택)
   - 주의: 갈림길 transition은 반드시 2개 이상을 동시에 생성해야 하며,
     이를 위해 manage_activities의 branch_from 대신 set_activity_branch를 사용
5. **문제 생성**: upsert_problem으로 퀴즈/활동지 문제 생성
   - 제목에 `/` 기호 사용 불가 (예: `[O/X]` → `[OX]`)
   - blocks는 필수 (content는 검색용 평문)
   - quiz 타입: blocks에 `quiz` 객체 포함 (quizType, answer, choices, commentary)
   - sheet 타입: blocks에 `root`만 포함
6. **문제 연결**: manage_problem_collections(action="create")로 활동에 문제 연결
   - QuizActivity, SheetActivity 등 문제 기반 활동에 필수
7. **검증**: get_material_detail로 활동 목록, 유형, 분기, 문제 연결 확인
   - type이 "미연결"로 표시되면 activitiable 생성이 실패한 것 → 활동 재생성 필요

## 주의사항

- 활동 삭제 시 코스 흐름(transition) 체인이 끊어짐. 중간 활동 삭제 후 복구 불가.
  문제 발생 시 자료 전체를 새로 생성하는 것이 안전.
""",
)
