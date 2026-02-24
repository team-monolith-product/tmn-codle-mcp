from codle_mcp.api.client import CodleAPIError, client
from codle_mcp.api.models import (
    build_jsonapi_payload,
    extract_list,
    extract_single,
    format_problem_summary,
    snake_to_pascal,
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

    ## blocks 형식 (sheet 타입)
    ```json
    {
      "root": { "children": [{"type": "paragraph", "children": [{"text": "문제 본문"}]}] }
    }
    ```
    sheet 타입은 quiz 객체 없이 root만 포함합니다.

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
    name: str | None = None,
    is_random: bool = False,
    problem_count: int | None = None,
) -> str:
    """활동(Activity)에 문제 세트(ProblemCollection)를 생성하고 문제를 연결합니다.

    QuizActivity, SheetActivity 등 문제를 포함하는 활동에 사용합니다.
    활동 생성 후 이 도구로 문제를 연결해야 학생에게 문제가 표시됩니다.

    ## 워크플로우
    1. upsert_problem으로 문제 생성 → problem_id 획득
    2. manage_problem_collections(action="create", activity_id=..., problem_ids=[...])
       → ProblemCollection 생성 + 문제 연결을 한 번에 수행

    ## 동작 방식
    - create: ProblemCollection 생성 후, problem_ids로 지정된 문제들을 순서대로 연결
    - add_problems: 기존 ProblemCollection에 문제 추가
    - delete: ProblemCollection 삭제

    Args:
        action: 수행할 작업 ("create", "add_problems", "delete")
        activity_id: 활동 ID (create 시 필수). 활동의 activitiable_id가 자동으로 사용됩니다.
        problem_ids: 연결할 문제 ID 목록 (create, add_problems 시 필수)
        problem_collection_id: ProblemCollection ID (add_problems, delete 시 필수)
        name: ProblemCollection 이름 (create 시 선택, 기본값: 활동 이름)
        is_random: 문제 랜덤 출제 여부 (기본 false)
        problem_count: 랜덤 출제 시 문제 수 (is_random=true일 때만 사용)
    """
    if action == "create":
        if not activity_id:
            return "create 시 activity_id는 필수입니다."
        if not problem_ids:
            return "create 시 problem_ids는 필수입니다."

        # 활동 정보 조회하여 activitiable_id 획득
        activity_resp = await client.get_activity(activity_id)
        data = activity_resp.get("data", {})
        attrs = data.get("attributes", {})
        activitiable_id = attrs.get("activitiable_id")
        activitiable_type = attrs.get("activitiable_type", "")

        # Fallback: JSONAPI relationships에서 polymorphic 관계 추출
        if not activitiable_id:
            rel = (data.get("relationships") or {}).get("activitiable", {}).get("data") or {}
            activitiable_id = rel.get("id")
            raw_type = rel.get("type", "")  # snake_case (e.g. "quiz_activity")
            activitiable_type = snake_to_pascal(raw_type) if raw_type else ""

        if not activitiable_id:
            return f"활동 [{activity_id}]에서 activitiable_id를 찾을 수 없습니다."

        # activitiable_type에 따른 owner 필드 결정
        owner_type = _pascal_to_snake(activitiable_type) if activitiable_type else "quiz_activity"

        # ProblemCollection 생성
        pc_attrs: dict = {
            f"{owner_type}_id": activitiable_id,
            "is_random": is_random,
        }
        if name:
            pc_attrs["name"] = name
        if problem_count is not None:
            pc_attrs["problem_count"] = problem_count

        pc_payload = build_jsonapi_payload("problem_collections", pc_attrs)
        try:
            pc_resp = await client.create_problem_collection(pc_payload)
        except CodleAPIError as e:
            return f"ProblemCollection 생성 실패: {e.detail}"
        pc = extract_single(pc_resp)
        pc_id = pc["id"]

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
                f"ProblemCollection [{pc_id}] 생성됨, 문제 연결 실패: {e.detail}. "
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

    elif action == "delete":
        if not problem_collection_id:
            return "delete 시 problem_collection_id는 필수입니다."
        try:
            await client.delete_problem_collection(problem_collection_id)
        except CodleAPIError as e:
            return f"ProblemCollection 삭제 실패: {e.detail}"
        return f"ProblemCollection 삭제 완료: {problem_collection_id}"

    else:
        return f"유효하지 않은 action: {action}. create, add_problems, delete 중 하나를 사용하세요."


def _pascal_to_snake(name: str) -> str:
    """PascalCase를 snake_case로 변환."""
    result = []
    for i, c in enumerate(name):
        if c.isupper() and i > 0:
            result.append("_")
        result.append(c.lower())
    return "".join(result)
