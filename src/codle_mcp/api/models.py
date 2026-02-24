"""JSON:API 응답을 파싱하여 LLM이 이해하기 쉬운 형태로 변환하는 유틸리티."""

from typing import Any


def extract_attributes(resource: dict) -> dict[str, Any]:
    """JSON:API resource에서 id + attributes를 평탄하게 추출."""
    result = {"id": resource.get("id")}
    result.update(resource.get("attributes", {}))
    return result


def extract_list(response: dict) -> list[dict[str, Any]]:
    """JSON:API 목록 응답에서 리소스 리스트 추출."""
    data = response.get("data", [])
    return [extract_attributes(item) for item in data]


def extract_single(response: dict) -> dict[str, Any]:
    """JSON:API 단건 응답에서 리소스 추출."""
    data = response.get("data", {})
    return extract_attributes(data)


def extract_included(response: dict, resource_type: str) -> list[dict[str, Any]]:
    """JSON:API included에서 특정 타입의 리소스들 추출."""
    included = response.get("included", [])
    return [extract_attributes(item) for item in included if item.get("type") == resource_type]


def build_jsonapi_payload(resource_type: str, attributes: dict, resource_id: str | None = None) -> dict:
    """JSON:API 형식의 요청 페이로드 생성."""
    data: dict[str, Any] = {
        "type": resource_type,
        "attributes": {k: v for k, v in attributes.items() if v is not None},
    }
    if resource_id:
        data["id"] = resource_id
    return {"data": data}


def format_material_summary(material: dict) -> str:
    """Material을 LLM이 읽기 쉬운 텍스트로 포맷."""
    public = "공개" if material.get("is_public") else "비공개"
    return f"- [{material['id']}] {material.get('name', '(무제)')} ({public})"


def format_problem_summary(problem: dict) -> str:
    """Problem을 LLM이 읽기 쉬운 텍스트로 포맷."""
    ptype = problem.get("problem_type", "unknown")
    return f"- [{problem['id']}] {problem.get('title', '(무제)')} (type: {ptype})"


def format_bundle_summary(bundle: dict) -> str:
    """MaterialBundle을 LLM이 읽기 쉬운 텍스트로 포맷."""
    published = "게시됨" if bundle.get("is_published") else "미게시"
    return f"- [{bundle['id']}] {bundle.get('title', '(무제)')} ({published})"
