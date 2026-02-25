from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def mock_client():
    """CodleClient 싱글톤을 AsyncMock으로 교체."""
    from codle_mcp.api.client import CodleClient

    mc = AsyncMock(spec=CodleClient)
    mc.user_id = "test-user-123"
    with (
        patch("codle_mcp.tools.activities.client", mc),
        patch("codle_mcp.tools.materials.client", mc),
        patch("codle_mcp.tools.problems.client", mc),
        patch("codle_mcp.tools.bundles.client", mc),
        patch("codle_mcp.tools.tags.client", mc),
    ):
        yield mc


def make_jsonapi_response(resource_type, resource_id, attrs=None, relationships=None, included=None):
    """Rails JSONAPI::Serializer 형식 응답 생성."""
    data = {"type": resource_type, "id": str(resource_id), "attributes": attrs or {}}
    if relationships:
        data["relationships"] = relationships
    resp = {"data": data}
    if included:
        resp["included"] = included
    return resp


def make_jsonapi_list_response(resource_type, items, included=None):
    """Rails JSONAPI::Serializer 형식 목록 응답 생성."""
    data = [
        {"type": resource_type, "id": str(item.pop("id")), "attributes": item}
        for item in items
    ]
    resp = {"data": data}
    if included:
        resp["included"] = included
    return resp
