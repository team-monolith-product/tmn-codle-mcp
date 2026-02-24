from codle_mcp.api.client import client
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

    Args:
        title: 문제 제목 (필수, 최대 255자)
        problem_type: 문제 유형 (필수, "judge"=코딩, "quiz"=퀴즈, "sheet"=시트, "descriptive"=서술형)
        problem_id: 수정할 문제의 ID (생략 시 새로 생성)
        content: 문제 본문 텍스트
        blocks: 문제 본문 (Lexical 에디터 JSON 형식)
        is_public: 공개 여부 (기본 False)
        timeout: 실행 제한 시간(초) - judge 타입에서 사용 (기본 1)
        skeleton_code: 기본 제공 코드 - judge 타입에서 사용
        tag_ids: 연결할 태그 ID 목록
        commentary: 문제 해설 (Lexical 에디터 JSON 형식)
    """
    if problem_type not in VALID_PROBLEM_TYPES:
        return f"유효하지 않은 problem_type: {problem_type}. {', '.join(VALID_PROBLEM_TYPES)} 중 하나를 사용하세요."

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
