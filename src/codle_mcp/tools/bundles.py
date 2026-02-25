from codle_mcp.api.client import CodleAPIError, client
from codle_mcp.api.models import (
    build_jsonapi_payload,
    extract_list,
    extract_single,
    format_bundle_summary,
    format_material_summary,
)
from codle_mcp.app import mcp


@mcp.tool()
async def list_bundles(
    query: str | None = None,
    is_published: bool | None = None,
    is_official: bool | None = None,
    tag_ids: list[str] | None = None,
    page_size: int = 20,
    page_number: int = 1,
) -> str:
    """시리즈(MaterialBundle) 목록을 조회합니다.

    시리즈는 여러 자료를 차시 순서로 묶은 커리큘럼입니다.

    Args:
        query: 검색 키워드 (시리즈 제목에서 검색, 공백 무시)
        is_published: 게시 여부 필터 (True=게시된 시리즈만, False=미게시만, None=전체)
        is_official: 공식 시리즈 여부 필터
        tag_ids: 필터링할 태그 ID 목록 (material_bundle_category 도메인 태그)
        page_size: 페이지당 결과 수 (기본 20, 최대 100)
        page_number: 페이지 번호 (1부터 시작)
    """
    await client.ensure_auth()
    params: dict = {
        "page[size]": min(page_size, 100),
        "page[number]": page_number,
    }
    if query:
        params["filter[compact_title]"] = query.replace(" ", "")
    if is_official is not None:
        params["filter[is_official_eq]"] = str(is_official).lower()
    if tag_ids:
        params["filter[material_bundle_category_tag_ids]"] = ",".join(tag_ids)
    # is_published 필터: 미지정 시 false(내 시리즈) 기본값 (ransack _eq suffix 필수)
    effective_published = is_published if is_published is not None else False
    params["filter[is_published_eq]"] = str(effective_published).lower()
    # 비공개 번들 조회 시 user_id 필터 필수
    if not effective_published:
        if not client.user_id:
            return "인증된 user_id가 없어 시리즈를 조회할 수 없습니다. 인증 설정을 확인하세요."
        params["filter[user_id_eq]"] = client.user_id

    try:
        response = await client.list_material_bundles(params)
    except CodleAPIError as e:
        if e.status_code in (400, 403):
            return (
                f"시리즈 조회 실패 ({e.status_code}): {e.detail}\n"
                "유효한 필터 조합:\n"
                "  1. is_published=true (단독, user_id 불가)\n"
                "  2. is_published=false + user_id (자동 설정됨)\n"
                f"전송된 파라미터: {params}"
            )
        raise
    bundles = extract_list(response)

    if not bundles:
        return "시리즈가 없습니다."

    lines = [f"시리즈 목록 ({len(bundles)}건):"]
    for b in bundles:
        lines.append(format_bundle_summary(b))
    return "\n".join(lines)


@mcp.tool()
async def get_bundle_detail(bundle_id: str) -> str:
    """시리즈(MaterialBundle)의 상세 정보를 조회합니다.

    시리즈에 포함된 자료 목록과 순서를 확인할 수 있습니다.

    Args:
        bundle_id: 조회할 시리즈의 ID
    """
    params = {"include": "materials,tags"}
    response = await client.get_material_bundle(bundle_id, params)
    bundle = extract_single(response)

    included = response.get("included", [])
    materials = [
        {"id": i["id"], **i.get("attributes", {})} for i in included if i.get("type") == "material"
    ]
    materials.sort(key=lambda m: m.get("position") or 0)
    tags = [{"id": i["id"], **i.get("attributes", {})} for i in included if i.get("type") == "tag"]

    lines = [
        f"시리즈: {bundle.get('title', '(무제)')}",
        f"ID: {bundle['id']}",
        f"게시: {'예' if bundle.get('is_published') else '아니오'}",
        f"공식: {'예' if bundle.get('is_official') else '아니오'}",
    ]

    if tags:
        tag_names = [f"{t.get('name', '')} ({t.get('domain', '')})" for t in tags]
        lines.append(f"태그: {', '.join(tag_names)}")

    if materials:
        lines.append(f"\n포함된 자료 ({len(materials)}개):")
        for i, m in enumerate(materials, 1):
            lines.append(f"  {i}차시: {format_material_summary(m)}")
    else:
        lines.append("\n포함된 자료: 없음")

    return "\n".join(lines)


@mcp.tool()
async def manage_bundle(
    action: str,
    bundle_id: str | None = None,
    title: str | None = None,
    description: dict | None = None,
    tag_ids: list[str] | None = None,
) -> str:
    """시리즈(MaterialBundle)를 생성하거나 수정합니다.

    시리즈는 여러 자료를 차시 순서로 묶은 커리큘럼입니다.
    자료를 시리즈에 추가하려면 update_material로 자료의 material_bundle_id와 position을 설정하세요.
    user_id는 인증된 사용자로 자동 설정됩니다.

    Args:
        action: 수행할 작업 ("create", "update", "delete")
        bundle_id: 시리즈 ID (update, delete 시 필수)
        title: 시리즈 제목 (create 시 필수, 최대 64자)
        description: 시리즈 설명 (Lexical 에디터 JSON 형식)
        tag_ids: 연결할 태그 ID 목록
    """
    if action == "create":
        if not title:
            return "create 시 title은 필수입니다."

        attrs: dict = {"title": title}
        if description is not None:
            attrs["description"] = description

        payload = build_jsonapi_payload("material_bundles", attrs)
        response = await client.create_material_bundle(payload)
        bundle = extract_single(response)
        return f"시리즈 생성 완료: [{bundle['id']}] {bundle.get('title')}"

    elif action == "update":
        if not bundle_id:
            return "update 시 bundle_id는 필수입니다."

        attrs = {}
        if title is not None:
            attrs["title"] = title
        if description is not None:
            attrs["description"] = description

        if not attrs:
            return "수정할 항목이 없습니다."

        payload = build_jsonapi_payload("material_bundles", attrs, bundle_id)
        response = await client.update_material_bundle(bundle_id, payload)
        bundle = extract_single(response)
        return f"시리즈 수정 완료: [{bundle['id']}] {bundle.get('title')}"

    elif action == "delete":
        if not bundle_id:
            return "delete 시 bundle_id는 필수입니다."
        await client.delete_material_bundle(bundle_id)
        return f"시리즈 삭제 완료: {bundle_id}"

    else:
        return f"유효하지 않은 action: {action}. create, update, delete 중 하나를 사용하세요."
