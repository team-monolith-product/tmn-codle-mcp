from codle_mcp.api.client import client, CodleAPIError
from codle_mcp.api.models import build_jsonapi_payload, extract_single
from codle_mcp.app import mcp


ACTIVITIABLE_TYPES = [
    "QuizActivity",
    "StudioActivity",
    "EntryActivity",
    "ScratchActivity",
    "BoardActivity",
    "VideoActivity",
    "PdfActivity",
    "SheetActivity",
    "HtmlActivity",
    "GenerativeHtmlActivity",
    "MakecodeActivity",
    "CodapActivity",
    "EmbeddedActivity",
    "SocroomActivity",
    "AiRecommendQuizActivity",
]


@mcp.tool()
async def manage_activities(
    action: str,
    material_id: str | None = None,
    activity_id: str | None = None,
    name: str | None = None,
    activity_type: str | None = None,
    depth: int = 0,
    tag_ids: list[str] | None = None,
    problem_collection_ids: list[str] | None = None,
    before_activity_ids: list[str] | None = None,
    after_activity_ids: list[str] | None = None,
) -> str:
    """자료(Material) 내 활동(Activity)을 추가, 수정, 삭제합니다.

    활동은 자료를 구성하는 단위입니다. 퀴즈, 코딩, 보드, 영상 등 다양한 유형을 지원합니다.

    Args:
        action: 수행할 작업 ("create", "update", "delete", "duplicate")
        material_id: 자료 ID (create 시 필수)
        activity_id: 활동 ID (update, delete, duplicate 시 필수)
        name: 활동 이름 (create 시 필수, 최대 64자)
        activity_type: 활동 유형 (create 시 필수). 사용 가능: QuizActivity, StudioActivity,
            EntryActivity, ScratchActivity, BoardActivity, VideoActivity, PdfActivity,
            SheetActivity, HtmlActivity, GenerativeHtmlActivity, MakecodeActivity,
            CodapActivity, EmbeddedActivity, SocroomActivity, AiRecommendQuizActivity
        depth: 활동 깊이 (0=h1, 1=h2, 2=h3)
        tag_ids: 연결할 태그 ID 목록
        problem_collection_ids: 연결할 문제 컬렉션 ID 목록 (퀴즈/시트 활동용)
        before_activity_ids: 이 활동 이전에 와야 할 활동 ID 목록
        after_activity_ids: 이 활동 이후에 와야 할 활동 ID 목록
    """
    if action == "create":
        if not material_id or not name or not activity_type:
            return "create 시 material_id, name, activity_type은 필수입니다."
        if activity_type not in ACTIVITIABLE_TYPES:
            return f"유효하지 않은 activity_type: {activity_type}. 사용 가능: {', '.join(ACTIVITIABLE_TYPES)}"

        attrs: dict = {
            "name": name,
            "material_id": material_id,
            "depth": depth,
            "activitiable": {"type": activity_type},
        }
        if tag_ids:
            attrs["tag_ids"] = tag_ids
        if problem_collection_ids:
            attrs["problem_collection_ids"] = problem_collection_ids
        if before_activity_ids:
            attrs["before_activity_ids"] = before_activity_ids
        if after_activity_ids:
            attrs["after_activity_ids"] = after_activity_ids

        payload = build_jsonapi_payload("activities", attrs)
        response = await client.create_activity(payload)
        activity = extract_single(response)
        return f"활동 생성 완료: [{activity['id']}] {activity.get('name')} (type: {activity_type})"

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
        if problem_collection_ids is not None:
            attrs["problem_collection_ids"] = problem_collection_ids
        if before_activity_ids is not None:
            attrs["before_activity_ids"] = before_activity_ids
        if after_activity_ids is not None:
            attrs["after_activity_ids"] = after_activity_ids

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
