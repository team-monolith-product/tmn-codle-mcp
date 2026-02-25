import json as _json

from codle_mcp.api.client import CodleAPIError, client
from codle_mcp.api.models import (
    build_jsonapi_payload,
    extract_list,
    extract_single,
    format_problem_summary,
)
from codle_mcp.app import mcp

VALID_PROBLEM_TYPES = ["judge", "quiz", "sheet", "descriptive"]


@mcp.tool()
async def search_problems(
    query: str | None = None,
    problem_type: str | None = None,
    tag_ids: list[str] | None = None,
    is_public: bool | None = None,
    page_size: int = 20,
    page_number: int = 1,
) -> str:
    """문제(Problem)를 검색합니다.

    기존 문제를 찾아 자료에 재활용하거나 참고할 수 있습니다.

    Args:
        query: 검색 키워드 (문제 제목에서 검색)
        problem_type: 문제 유형 필터 ("judge", "quiz", "sheet", "descriptive")
        tag_ids: 필터링할 태그 ID 목록
        is_public: 공개 여부 필터
        page_size: 페이지당 결과 수 (기본 20, 최대 100)
        page_number: 페이지 번호 (1부터 시작)
    """
    params: dict = {
        "page[size]": min(page_size, 100),
        "page[number]": page_number,
        "filter[is_exam]": "false",
    }
    if query:
        params["filter[query]"] = query
    if problem_type and problem_type in VALID_PROBLEM_TYPES:
        params["filter[problem_type]"] = problem_type
    if is_public is not None:
        params["filter[is_public]"] = str(is_public).lower()
    if tag_ids:
        params["filter[tag_ids]"] = ",".join(tag_ids)

    response = await client.list_problems(params)
    problems = extract_list(response)

    if not problems:
        return "검색 결과가 없습니다."

    lines = [f"문제 검색 결과 ({len(problems)}건):"]
    for p in problems:
        lines.append(format_problem_summary(p))
    return "\n".join(lines)


@mcp.tool()
async def upsert_problem(
    title: str,
    problem_type: str,
    problem_id: str | None = None,
    content: str | None = None,
    blocks: dict | None = None,
    is_public: bool = False,
    timeout: int = 1,
    skeleton_code: str | None = None,
    tag_ids: list[str] | None = None,
    commentary: dict | None = None,
) -> str:
    """문제(Problem)를 생성하거나 수정합니다.

    problem_id를 지정하면 기존 문제를 수정하고, 생략하면 새 문제를 생성합니다.
    user_id는 인증된 사용자로 자동 설정됩니다.

    ## 제약 사항
    - title에 `/` 기호 사용 불가 (예: `[O/X]` → `[OX]`로 변경)
    - blocks는 필수. content는 검색용 평문이며, 렌더링은 blocks 기준

    ## blocks 형식 (quiz 타입)
    ```json
    {
      "root": { "children": [{"type": "paragraph", "children": [{"text": "문제 본문"}]}] },
      "quiz": {
        "quizType": "ox | multipleChoice | shortAnswer",
        "answer": "O 또는 X (ox) | 0부터 시작하는 인덱스 (multipleChoice) | 정답 텍스트 (shortAnswer)",
        "choices": ["선택지1", "선택지2", ...],
        "commentary": "해설 텍스트"
      }
    }
    ```
    - OX: `quizType="ox"`, `answer="O"` 또는 `"X"`
    - 객관식: `quizType="multipleChoice"`, `answer=0`(첫번째 선택지), `choices=[...]`
    - 주관식: `quizType="shortAnswer"`, `answer="정답"`

    ## blocks 형식 (sheet/descriptive 타입)
    ```json
    {
      "root": { "children": [{"type": "paragraph", "children": [{"text": "문제 본문"}]}] }
    }
    ```
    sheet/descriptive 타입은 quiz 객체 없이 root만 포함합니다.

    ## 문제 타입 선택 가이드
    - quiz: OX, 객관식, 주관식 — 정답이 있는 퀴즈 (blocks에 quiz 객체 필수)
    - sheet: 활동지 문항 — 자유 작성형 (SheetActivity용)
    - descriptive: 서술형 — 자유 작성형, 정답 일치 채점 아님 (QuizActivity에서 서술형 문항)
    - judge: 코딩 문제

    **주의**: 스크립트에서 [서술형]으로 표기된 문제는 quiz/shortAnswer가 아닌 descriptive를 사용하세요.

    Args:
        title: 문제 제목 (필수, 최대 255자, `/` 기호 사용 불가)
        problem_type: 문제 유형 (필수, "judge"=코딩, "quiz"=퀴즈, "sheet"=시트, "descriptive"=서술형)
        problem_id: 수정할 문제의 ID (생략 시 새로 생성)
        content: 문제 본문 텍스트 (검색용 평문)
        blocks: 문제 본문 (Lexical 에디터 JSON 형식, 필수)
        is_public: 공개 여부 (기본 False)
        timeout: 실행 제한 시간(초) - judge 타입에서 사용 (기본 1)
        skeleton_code: 기본 제공 코드 - judge 타입에서 사용
        tag_ids: 연결할 태그 ID 목록
        commentary: 문제 해설 (Lexical 에디터 JSON 형식)
    """
    if problem_type not in VALID_PROBLEM_TYPES:
        return f"유효하지 않은 problem_type: {problem_type}. {', '.join(VALID_PROBLEM_TYPES)} 중 하나를 사용하세요."
    if "/" in title:
        return f"제목에 `/` 기호를 사용할 수 없습니다. 현재 제목: {title}"
    if not blocks and not problem_id:
        return "blocks는 필수입니다. Lexical 에디터 JSON 형식으로 문제 본문을 제공하세요."

    attrs: dict = {"title": title}
    if problem_id is None:
        attrs["problem_type"] = problem_type
    if content is not None:
        attrs["content"] = content
    if blocks is not None:
        attrs["blocks"] = blocks
    attrs["is_public"] = is_public
    attrs["timeout"] = timeout
    if skeleton_code is not None:
        attrs["skeleton_code"] = skeleton_code
    if tag_ids is not None:
        attrs["tag_ids"] = tag_ids
    if commentary is not None:
        if isinstance(commentary, str):
            try:
                commentary = _json.loads(commentary)
            except (ValueError, TypeError):
                pass
        attrs["commentary"] = commentary

    payload = build_jsonapi_payload("problems", attrs, problem_id)

    if problem_id:
        response = await client.update_problem(problem_id, payload)
        problem = extract_single(response)
        return f"문제 수정 완료: [{problem['id']}] {problem.get('title')}"
    else:
        response = await client.create_problem(payload)
        problem = extract_single(response)
        return f"문제 생성 완료: [{problem['id']}] {problem.get('title')} (type: {problem_type})"


@mcp.tool()
async def manage_problem_collections(
    action: str,
    activity_id: str | None = None,
    problem_ids: list[str] | None = None,
    problem_collection_id: str | None = None,
) -> str:
    """활동(Activity)의 ProblemCollection에 문제를 연결합니다.

    QuizActivity, SheetActivity 등 문제를 포함하는 활동에 사용합니다.
    활동 생성 후 이 도구로 문제를 연결해야 학생에게 문제가 표시됩니다.

    ## 중요: ProblemCollection은 자동 생성됨
    Rails가 QuizActivity/SheetActivity 타입의 Activity를 생성할 때
    ProblemCollection을 자동으로 생성합니다. 따라서 별도 생성이 불필요합니다.

    ## 워크플로우
    1. manage_activities(action="create")로 활동 생성 (ProblemCollection 자동 생성됨)
    2. upsert_problem으로 문제 생성 → problem_id 획득
    3. manage_problem_collections(action="create", activity_id=..., problem_ids=[...])
       → 자동 생성된 ProblemCollection을 찾아 문제를 연결

    ## 동작 방식
    - create: activity_id로 자동 생성된 ProblemCollection을 찾아 문제 연결
    - add_problems: 기존 ProblemCollection에 문제 추가 (problem_collection_id 직접 지정)

    Args:
        action: 수행할 작업 ("create", "add_problems")
        activity_id: 활동 ID (create 시 필수)
        problem_ids: 연결할 문제 ID 목록 (create, add_problems 시 필수)
        problem_collection_id: ProblemCollection ID (add_problems 시 필수)
    """
    if action == "create":
        if not activity_id:
            return "create 시 activity_id는 필수입니다."
        if not problem_ids:
            return "create 시 problem_ids는 필수입니다."

        # 활동에서 자동 생성된 ProblemCollection 찾기
        try:
            act_resp = await client.get_activity(
                activity_id, {"include": "problem_collections.pcps"}
            )
        except CodleAPIError as e:
            return f"활동 조회 실패 (activity_id={activity_id}): {e.detail}"

        pc_rel = (
            act_resp.get("data", {})
            .get("relationships", {})
            .get("problem_collections", {})
            .get("data")
        )
        if not pc_rel:
            return (
                f"활동 [{activity_id}]에 ProblemCollection이 없습니다. "
                f"QuizActivity 또는 SheetActivity 타입의 활동인지 확인하세요."
            )

        # 첫 번째 ProblemCollection 사용
        pc_id = pc_rel[0]["id"] if isinstance(pc_rel, list) else pc_rel["id"]

        # 문제 연결 (do_many)
        link_items = [
            {
                "problem_collection_id": pc_id,
                "problem_id": pid,
                "position": idx,
            }
            for idx, pid in enumerate(problem_ids)
        ]
        do_many_payload = {
            "data": {
                "type": "problem_collections_problem",
                "attributes": {"do_many": {"create": link_items}},
            }
        }
        try:
            await client.do_many_problem_collections_problems(do_many_payload)
        except CodleAPIError as e:
            return (
                f"ProblemCollection [{pc_id}] 발견됨, 문제 연결 실패: {e.detail}. "
                f"add_problems로 재시도하세요."
            )

        return (
            f"ProblemCollection 생성 및 문제 연결 완료: "
            f"[{pc_id}] (활동: {activity_id}, 문제 {len(problem_ids)}개 연결)"
        )

    elif action == "add_problems":
        if not problem_collection_id:
            return "add_problems 시 problem_collection_id는 필수입니다."
        if not problem_ids:
            return "add_problems 시 problem_ids는 필수입니다."

        link_items = [
            {
                "problem_collection_id": problem_collection_id,
                "problem_id": pid,
                "position": idx,
            }
            for idx, pid in enumerate(problem_ids)
        ]
        do_many_payload = {
            "data": {
                "type": "problem_collections_problem",
                "attributes": {"do_many": {"create": link_items}},
            }
        }
        try:
            await client.do_many_problem_collections_problems(do_many_payload)
        except CodleAPIError as e:
            return f"문제 연결 실패: {e.detail}"

        return (
            f"문제 연결 완료: ProblemCollection [{problem_collection_id}]에 "
            f"문제 {len(problem_ids)}개 추가"
        )

    else:
        return f"유효하지 않은 action: {action}. create, add_problems 중 하나를 사용하세요."
