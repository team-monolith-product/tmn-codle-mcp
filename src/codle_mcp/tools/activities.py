from codle_mcp.api.client import CodleAPIError, client
from codle_mcp.api.models import build_jsonapi_payload, extract_single
from codle_mcp.app import mcp


# activity_type → activitiable 생성 API 경로
ACTIVITIABLE_ENDPOINTS = {
    "QuizActivity": "/api/v1/quiz_activities",
    "StudioActivity": "/api/v1/studio_activities",
    "EntryActivity": "/api/v1/entry_activities",
    "ScratchActivity": "/api/v1/scratch_activities",
    "BoardActivity": "/api/v1/board_activities",
    "VideoActivity": "/api/v1/video_activities",
    "PdfActivity": "/api/v1/pdf_activities",
    "SheetActivity": "/api/v1/sheet_activities",
    "HtmlActivity": "/api/v1/html_activities",
    "GenerativeHtmlActivity": "/api/v1/generative_html_activities",
    "MakecodeActivity": "/api/v1/makecode_activities",
    "CodapActivity": "/api/v1/codap_activities",
    "EmbeddedActivity": "/api/v1/embedded_activities",
    "SocroomActivity": "/api/v1/socroom_activities",
    "AiRecommendQuizActivity": "/api/v1/ai_recommend_quiz_activities",
}

ACTIVITIABLE_TYPES = list(ACTIVITIABLE_ENDPOINTS.keys())


def _pascal_to_snake(name: str) -> str:
    """PascalCase를 snake_case로 변환."""
    result = []
    for i, c in enumerate(name):
        if c.isupper() and i > 0:
            result.append("_")
        result.append(c.lower())
    return "".join(result)


async def _create_transition(before_id: str, after_id: str, level: str | None = None) -> None:
    """activity_transition 생성."""
    attrs: dict = {"before_activity_id": before_id, "after_activity_id": after_id}
    if level:
        attrs["level"] = level
    payload = {"data": {"type": "activity_transition", "attributes": attrs}}
    await client.create_activity_transition(payload)


async def _get_material_transitions(material_id: str, exclude_id: str = "") -> tuple[list[dict], list[str]]:
    """material의 transition 목록과 활동 ID 목록을 반환."""
    mat_resp = await client.get_material(material_id, {"include": "activities,activity_transitions"})
    included = mat_resp.get("included", [])
    transitions = [i for i in included if i.get("type") == "activity_transition"]
    existing_ids = [i["id"] for i in included if i.get("type") == "activity" and i["id"] != exclude_id]
    return transitions, existing_ids


async def _find_tail_activity(material_id: str, exclude_id: str) -> str | None:
    """material의 마지막 활동(outgoing transition 없는 활동) ID를 반환."""
    transitions, existing_ids = await _get_material_transitions(material_id, exclude_id)

    if not existing_ids:
        return None

    before_ids = {str(t["attributes"]["before_activity_id"]) for t in transitions}
    tails = [aid for aid in existing_ids if aid not in before_ids]
    return tails[0] if len(tails) == 1 else None


@mcp.tool()
async def manage_activities(
    action: str,
    material_id: str | None = None,
    activity_id: str | None = None,
    name: str | None = None,
    activity_type: str | None = None,
    depth: int = 0,
    tag_ids: list[str] | None = None,
    branch_from: str | None = None,
) -> str:
    """자료(Material) 내 활동(Activity)을 추가, 수정, 삭제합니다.

    활동은 자료를 구성하는 학습 단위입니다. 순서대로 생성하면 자동으로 선형 연결됩니다.

    ## 활동 유형 매핑
    입력 스크립트의 키워드 → activity_type:
    - 교안, 교안 실습 → HtmlActivity
    - 퀴즈 → QuizActivity
    - 보드 → BoardActivity
    - 활동지 → SheetActivity
    - 코딩, Python → StudioActivity
    - 영상 → VideoActivity
    - 엔트리 → EntryActivity
    - 스크래치 → ScratchActivity
    - PDF → PdfActivity

    ## 자동 연결
    활동을 순서대로 create하면 이전 활동 → 새 활동 transition이 자동 생성됩니다.
    반드시 코스 흐름 순서대로 생성하세요.

    ## depth (들여쓰기)
    - 0: 메인 활동 (코스 흐름에서 독립 노드)
    - 1: 하위 활동 (직전 depth=0 활동의 하위로 들여쓰기 표시)
    - 2: 하위의 하위

    ## 갈림길(branch)
    branch_from을 지정하면 활동만 생성하고 transition은 생성하지 않습니다.
    모든 갈림길 활동 생성 후 set_activity_branch로 분기를 일괄 설정하세요.
    예) 활동 "48330"에서 3갈래 분기:
      create(..., branch_from="48330")  # 기본(mid) 활동
      create(..., branch_from="48330")  # 보완(low) 활동
      create(..., branch_from="48330")  # 정복(high) 활동
      set_activity_branch(branch_from="48330", mid_activity_id="...", low_activity_id="...", high_activity_id="...")

    ## 문제 연결
    QuizActivity, SheetActivity 생성 후 manage_problem_collections로 문제를 연결해야 합니다.
    문제가 연결되지 않으면 빈 퀴즈/활동지로 표시됩니다.

    Args:
        action: 수행할 작업 ("create", "update", "delete", "duplicate")
        material_id: 자료 ID (create 시 필수)
        activity_id: 활동 ID (update, delete, duplicate 시 필수)
        name: 활동 이름 (create 시 필수, 최대 64자)
        activity_type: 활동 유형 (create 시 필수). 주요: HtmlActivity, QuizActivity,
            BoardActivity, SheetActivity, StudioActivity, VideoActivity.
            기타: EntryActivity, ScratchActivity, PdfActivity, GenerativeHtmlActivity,
            MakecodeActivity, CodapActivity, EmbeddedActivity, SocroomActivity,
            AiRecommendQuizActivity
        depth: 활동 깊이 (0=메인, 1=하위, 2=하위의 하위). 기본 0
        tag_ids: 연결할 태그 ID 목록
        branch_from: 갈림길 분기점 활동 ID. 지정 시 auto-chain 없이 활동만 생성됩니다.
            생성 후 set_activity_branch로 분기를 설정하세요.
    """
    if action == "create":
        if not material_id or not name or not activity_type:
            return "create 시 material_id, name, activity_type은 필수입니다."
        if activity_type not in ACTIVITIABLE_TYPES:
            return f"유효하지 않은 activity_type: {activity_type}. 사용 가능: {', '.join(ACTIVITIABLE_TYPES)}"

        # 1단계: activitiable 생성
        endpoint = ACTIVITIABLE_ENDPOINTS[activity_type]
        jsonapi_type = _pascal_to_snake(activity_type)
        activitiable_payload = {"data": {"type": jsonapi_type, "attributes": {}}}
        try:
            activitiable_response = await client._request("POST", endpoint, json=activitiable_payload)
        except CodleAPIError as e:
            return f"activitiable({activity_type}) 생성 실패: {e.detail}"
        activitiable_data = activitiable_response.get("data", {})
        activitiable_id = activitiable_data.get("id")
        if not activitiable_id:
            return f"activitiable({activity_type}) 생성 실패: 응답에 id 없음."

        # 2단계: activity 생성 (activitiable을 attributes로 연결)
        attrs: dict = {
            "name": name,
            "material_id": material_id,
            "depth": depth,
            "activitiable_type": activity_type,
            "activitiable_id": activitiable_id,
        }
        if tag_ids:
            attrs["tag_ids"] = tag_ids

        payload = build_jsonapi_payload("activities", attrs)
        response = await client.create_activity(payload)
        activity = extract_single(response)
        new_id = activity["id"]

        # 3단계: transition 생성 (갈림길 활동은 스킵)
        chain_msg = ""
        if branch_from:
            chain_msg = f". set_activity_branch로 갈림길 설정 필요 (branch_from={branch_from})"
        else:
            try:
                tail = await _find_tail_activity(material_id, new_id)
                if tail:
                    await _create_transition(tail, new_id)
                    chain_msg = f", {tail} → {new_id} 연결됨"
            except CodleAPIError as e:
                return f"transition 생성 실패: {e.detail} (활동 [{new_id}]은 생성됨)"

        return f"활동 생성 완료: [{new_id}] {activity.get('name')} (type: {activity_type}{chain_msg})"

    elif action == "update":
        if not activity_id:
            return "update 시 activity_id는 필수입니다."

        attrs = {}
        if name is not None:
            attrs["name"] = name
        if depth is not None:
            attrs["depth"] = depth
        if tag_ids is not None:
            attrs["tag_ids"] = tag_ids

        if not attrs:
            return "수정할 항목이 없습니다."

        payload = build_jsonapi_payload("activities", attrs, activity_id)
        response = await client.update_activity(activity_id, payload)
        activity = extract_single(response)
        return f"활동 수정 완료: [{activity['id']}] {activity.get('name')}"

    elif action == "delete":
        if not activity_id:
            return "delete 시 activity_id는 필수입니다."
        try:
            await client.delete_activity(activity_id)
        except CodleAPIError as e:
            return f"활동 삭제 실패: {e.detail}"
        return f"활동 삭제 완료: {activity_id}"

    elif action == "duplicate":
        if not activity_id:
            return "duplicate 시 activity_id는 필수입니다."
        response = await client.duplicate_activity(activity_id)
        activity = extract_single(response)
        return f"활동 복제 완료: [{activity['id']}] {activity.get('name')} (원본: {activity_id})"

    else:
        return f"유효하지 않은 action: {action}. create, update, delete, duplicate 중 하나를 사용하세요."


@mcp.tool()
async def set_activity_branch(
    material_id: str,
    branch_from: str,
    mid_activity_id: str,
    low_activity_id: str | None = None,
    high_activity_id: str | None = None,
) -> str:
    """갈림길 transition을 일괄 생성합니다.

    manage_activities로 각 갈림길 활동을 생성한 후, 이 도구로 분기를 설정합니다.
    do_many API를 사용하여 모든 branch transition을 한 번에 생성합니다
    (Rails 검증 상 1개씩 생성은 불가능하며, 반드시 2개 이상을 동시 생성해야 합니다).

    Args:
        material_id: 자료 ID
        branch_from: 분기점 활동 ID (이 활동에서 갈림길이 시작됨)
        mid_activity_id: 기본 갈림길 활동 ID (필수)
        low_activity_id: 보완 갈림길 활동 ID
        high_activity_id: 정복 갈림길 활동 ID
    """
    # 1단계: 기존 transition 조회 (branch_from에서 나가는 것만 수집)
    mat_resp = await client.get_material(material_id, {"include": "activity_transitions"})
    included = mat_resp.get("included", [])
    existing_transitions = [i for i in included if i.get("type") == "activity_transition"]

    data_to_destroy = []
    for t in existing_transitions:
        attrs = t.get("attributes", {})
        if str(attrs.get("before_activity_id")) == str(branch_from):
            data_to_destroy.append({"id": t["id"]})

    # 2단계: 생성할 transition 목록 구성
    level_map = {"mid": mid_activity_id, "low": low_activity_id, "high": high_activity_id}
    data_to_create = []
    for level, after_id in level_map.items():
        if after_id:
            data_to_create.append({
                "attributes": {
                    "before_activity_id": branch_from,
                    "after_activity_id": after_id,
                    "level": level,
                }
            })

    if len(data_to_create) < 2:
        return "갈림길은 최소 2개 이상의 활동이 필요합니다. mid_activity_id와 low_activity_id 또는 high_activity_id를 지정하세요."

    # 3단계: do_many로 일괄 처리
    payload: dict = {"data_to_create": data_to_create}
    if data_to_destroy:
        payload["data_to_destroy"] = data_to_destroy

    try:
        await client.do_many_activity_transitions(payload)
    except CodleAPIError as e:
        return f"갈림길 설정 실패: {e.detail}"

    levels_created = [f"{level}={after_id}" for level, after_id in level_map.items() if after_id]
    destroyed_msg = f", 기존 transition {len(data_to_destroy)}개 제거" if data_to_destroy else ""
    return f"갈림길 설정 완료: {branch_from} → {', '.join(levels_created)}{destroyed_msg}"
