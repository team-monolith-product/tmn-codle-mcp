from codle_mcp.api.client import client
from codle_mcp.api.models import (
    build_jsonapi_payload,
    extract_list,
    extract_single,
    format_material_summary,
    snake_to_pascal,
)
from codle_mcp.app import mcp


@mcp.tool()
async def search_materials(
    query: str | None = None,
    tag_ids: list[str] | None = None,
    is_public: bool | None = None,
    page_size: int = 20,
    page_number: int = 1,
) -> str:
    """자료(Material)를 검색합니다.

    키워드, 태그, 공개 여부 등으로 기존 자료를 찾을 수 있습니다.
    새 자료를 만들기 전에 기존 자료를 먼저 검색하여 참고하세요.

    Args:
        query: 검색 키워드 (자료 이름에서 검색)
        tag_ids: 필터링할 태그 ID 목록
        is_public: 공개 여부 필터 (True=공개 자료, False/None=내 자료만)
        page_size: 페이지당 결과 수 (기본 20, 최대 100)
        page_number: 페이지 번호 (1부터 시작)
    """
    await client.ensure_auth()
    params: dict = {
        "page[size]": min(page_size, 100),
        "page[number]": page_number,
    }
    if query:
        params["filter[query]"] = query
    if is_public is not None:
        params["filter[is_public]"] = str(is_public).lower()
    # 비공개 자료 조회 시 user_id 필터 필수
    if is_public is not True and client.user_id:
        params["filter[user_id]"] = client.user_id
    if tag_ids:
        params["filter[tag_ids]"] = ",".join(tag_ids)

    response = await client.list_materials(params)
    materials = extract_list(response)

    if not materials:
        return "검색 결과가 없습니다."

    lines = [f"자료 검색 결과 ({len(materials)}건):"]
    for m in materials:
        lines.append(format_material_summary(m))
    return "\n".join(lines)


@mcp.tool()
async def get_material_detail(material_id: str) -> str:
    """자료(Material)의 상세 정보를 조회합니다.

    자료에 포함된 활동(Activity) 목록, 활동 유형, 문제 연결 여부, 분기 정보를 확인할 수 있습니다.
    자료를 수정하거나 복제하기 전에 현재 상태를 확인할 때 사용합니다.

    Args:
        material_id: 조회할 자료의 ID
    """
    params = {"include": "activities,activities.activitiable,tags,activity_transitions"}
    response = await client.get_material(material_id, params)
    material = extract_single(response)

    included = response.get("included", [])
    activities = []
    for i in included:
        if i.get("type") != "activity":
            continue
        a = {"id": i["id"], **i.get("attributes", {})}
        # activitiable_type이 attributes에 없으면 relationships에서 추출
        if not a.get("activitiable_type"):
            rel = (i.get("relationships") or {}).get("activitiable", {}).get("data") or {}
            if rel.get("id"):
                a["activitiable_id"] = rel["id"]
                a["activitiable_type"] = snake_to_pascal(rel.get("type", ""))
        activities.append(a)
    tags = [{"id": i["id"], **i.get("attributes", {})} for i in included if i.get("type") == "tag"]
    transitions = [
        {"id": i["id"], **i.get("attributes", {})}
        for i in included
        if i.get("type") == "activity_transition"
    ]

    lines = [
        f"자료: {material.get('name', '(무제)')}",
        f"ID: {material['id']}",
        f"공개: {'예' if material.get('is_public') else '아니오'}",
        f"공식: {'예' if material.get('is_official') else '아니오'}",
        f"레벨: {material.get('level', 0)}",
    ]

    if tags:
        tag_names = [f"{t.get('name', '')} ({t.get('domain', '')})" for t in tags]
        lines.append(f"태그: {', '.join(tag_names)}")

    if activities:
        # 활동 ID → 이름 매핑 (transition 표시용)
        activity_names = {str(a["id"]): a.get("name", "(무제)") for a in activities}

        lines.append(f"\n활동 ({len(activities)}개):")
        for a in activities:
            raw_depth = a.get("depth", 0)
            try:
                depth_val = int(raw_depth)
            except (ValueError, TypeError):
                depth_val = int(str(raw_depth).replace("h", "")) - 1 if str(raw_depth).startswith("h") else 0
            depth_prefix = "  " * depth_val
            act_type = a.get("activitiable_type", "")
            has_activitiable = bool(a.get("activitiable_id"))
            if not act_type:
                act_type = "미연결" if not has_activitiable else "?"
            # QuizActivity/SheetActivity는 문제 연결이 필요한 타입임을 표시
            needs_problems = act_type in ("QuizActivity", "SheetActivity")
            problem_info = ", 문제 연결 필요" if needs_problems else ""
            activitiable_info = ""
            if has_activitiable:
                activitiable_info = f", activitiable_id: {a['activitiable_id']}"
            lines.append(
                f"  {depth_prefix}[{a['id']}] {a.get('name', '(무제)')} "
                f"(type: {act_type}, depth: {raw_depth}{activitiable_info}{problem_info})"
            )
    else:
        lines.append("\n활동: 없음")

    if transitions:
        lines.append(f"\n코스 흐름 ({len(transitions)}개):")
        for t in transitions:
            before_id = str(t.get("before_activity_id", "?"))
            after_id = str(t.get("after_activity_id", "?"))
            level = t.get("level")
            before_name = activity_names.get(before_id, before_id)
            after_name = activity_names.get(after_id, after_id)
            if level:
                lines.append(f"  [{before_id}] {before_name} →({level}) [{after_id}] {after_name}")
            else:
                lines.append(f"  [{before_id}] {before_name} → [{after_id}] {after_name}")

    return "\n".join(lines)


@mcp.tool()
async def create_material(
    name: str,
    is_public: bool = False,
    tag_ids: list[str] | None = None,
    material_bundle_id: str | None = None,
    position: int | None = None,
) -> str:
    """새 자료(Material)를 생성합니다.

    자료는 여러 활동(Activity)을 담는 컨테이너입니다.
    전체 워크플로우: create_material → manage_activities(create)를 순서대로 반복 → 갈림길 추가.
    user_id는 인증된 사용자로 자동 설정됩니다.

    Args:
        name: 자료 이름 (필수, 최대 255자)
        is_public: 공개 여부 (기본 False). 한번 공개하면 비공개로 되돌릴 수 없음.
        tag_ids: 연결할 태그 ID 목록
        material_bundle_id: 소속 시리즈 ID (시리즈에 포함시킬 경우)
        position: 시리즈 내 순서 (material_bundle_id 설정 시 필수)
    """
    attrs: dict = {
        "name": name,
        "is_public": is_public,
    }
    if tag_ids:
        attrs["tag_ids"] = tag_ids
    if material_bundle_id:
        attrs["material_bundle_id"] = material_bundle_id
    if position is not None:
        attrs["position"] = position

    payload = build_jsonapi_payload("materials", attrs)
    response = await client.create_material(payload)
    material = extract_single(response)
    return f"자료 생성 완료: [{material['id']}] {material.get('name')}"


@mcp.tool()
async def update_material(
    material_id: str,
    name: str | None = None,
    is_public: bool | None = None,
    tag_ids: list[str] | None = None,
    material_bundle_id: str | None = None,
    position: int | None = None,
) -> str:
    """기존 자료(Material)의 정보를 수정합니다.

    변경하고 싶은 필드만 전달하면 됩니다. 전달하지 않은 필드는 유지됩니다.
    본인 소유 자료만 수정 가능합니다.

    Args:
        material_id: 수정할 자료의 ID
        name: 자료 이름
        is_public: 공개 여부. 공개(true)로만 변경 가능하며 비공개로 되돌릴 수 없음.
        tag_ids: 연결할 태그 ID 목록 (전체 교체)
        material_bundle_id: 소속 시리즈 ID
        position: 시리즈 내 순서
    """
    attrs: dict = {}
    if name is not None:
        attrs["name"] = name
    if is_public is not None:
        attrs["is_public"] = is_public
    if tag_ids is not None:
        attrs["tag_ids"] = tag_ids
    if material_bundle_id is not None:
        attrs["material_bundle_id"] = material_bundle_id
    if position is not None:
        attrs["position"] = position

    if not attrs:
        return "수정할 항목이 없습니다."

    payload = build_jsonapi_payload("materials", attrs, material_id)
    response = await client.update_material(material_id, payload)
    material = extract_single(response)
    return f"자료 수정 완료: [{material['id']}] {material.get('name')}"


@mcp.tool()
async def duplicate_material(material_id: str) -> str:
    """기존 자료(Material)를 복제합니다.

    원본 자료의 활동, 문제 등이 모두 복사됩니다.
    복제 후 update_material로 이름이나 내용을 수정하세요.

    Args:
        material_id: 복제할 원본 자료의 ID
    """
    response = await client.duplicate_material(material_id)
    material = extract_single(response)
    return f"자료 복제 완료: [{material['id']}] {material.get('name')} (원본: {material_id})"
