import pytest

from codle_mcp.api.client import CodleAPIError
from codle_mcp.tools.bundles import list_bundles, get_bundle_detail, manage_bundle

from .conftest import make_jsonapi_list_response, make_jsonapi_response


class TestListBundles:
    async def test_default_unpublished_with_user_id(self, mock_client):
        """기본 호출 → is_published=false + user_id 설정."""
        mock_client.list_material_bundles.return_value = make_jsonapi_list_response(
            "material_bundle",
            [{"id": "1", "title": "시리즈1", "is_published": False}],
        )

        result = await list_bundles()
        assert "시리즈1" in result

        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["filter[is_published_eq]"] == "false"
        assert call_params["filter[user_id_eq]"] == "test-user-123"

    async def test_published_no_user_id(self, mock_client):
        """is_published=True → user_id 미포함."""
        mock_client.list_material_bundles.return_value = make_jsonapi_list_response(
            "material_bundle",
            [{"id": "2", "title": "공개시리즈", "is_published": True}],
        )

        result = await list_bundles(is_published=True)
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["filter[is_published_eq]"] == "true"
        assert "filter[user_id_eq]" not in call_params

    async def test_unpublished_without_user_id(self, mock_client):
        """인증 user_id 없이 비공개 조회 → 에러."""
        mock_client.user_id = ""
        result = await list_bundles()
        assert "인증된 user_id가 없어" in result

    async def test_query_compact_title(self, mock_client):
        """query → compact_title 공백 제거."""
        mock_client.list_material_bundles.return_value = make_jsonapi_list_response(
            "material_bundle", []
        )

        await list_bundles(query="AI 교육")
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["filter[compact_title]"] == "AI교육"

    async def test_empty_result(self, mock_client):
        mock_client.list_material_bundles.return_value = {"data": []}
        result = await list_bundles()
        assert "시리즈가 없습니다" in result

    async def test_400_error_debug_message(self, mock_client):
        """API 400 에러 → 유효 필터 조합 안내."""
        mock_client.list_material_bundles.side_effect = CodleAPIError(400, "IncompleteFilter")

        result = await list_bundles()
        assert "시리즈 조회 실패 (400)" in result
        assert "유효한 필터 조합" in result
        assert "전송된 파라미터" in result

    async def test_403_error_debug_message(self, mock_client):
        """A2 수정: API 403 에러도 디버그 메시지 포함."""
        mock_client.list_material_bundles.side_effect = CodleAPIError(403, "ForbiddenUser")

        result = await list_bundles()
        assert "시리즈 조회 실패 (403)" in result
        assert "유효한 필터 조합" in result

    async def test_500_error_raises(self, mock_client):
        """400/403 이외 에러 → re-raise."""
        mock_client.list_material_bundles.side_effect = CodleAPIError(500, "Internal")

        with pytest.raises(CodleAPIError):
            await list_bundles()

    async def test_tag_ids_filter(self, mock_client):
        mock_client.list_material_bundles.return_value = {"data": []}
        await list_bundles(tag_ids=["10", "20"])
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["filter[material_bundle_category_tag_ids]"] == "10,20"

    async def test_is_official_filter(self, mock_client):
        mock_client.list_material_bundles.return_value = {"data": []}
        await list_bundles(is_official=True)
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["filter[is_official_eq]"] == "true"

    async def test_pagination(self, mock_client):
        mock_client.list_material_bundles.return_value = {"data": []}
        await list_bundles(page_size=50, page_number=3)
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["page[size]"] == 50
        assert call_params["page[number]"] == 3

    async def test_page_size_max_100(self, mock_client):
        mock_client.list_material_bundles.return_value = {"data": []}
        await list_bundles(page_size=200)
        call_params = mock_client.list_material_bundles.call_args[0][0]
        assert call_params["page[size]"] == 100


class TestGetBundleDetail:
    async def test_basic(self, mock_client):
        mock_client.get_material_bundle.return_value = {
            "data": {
                "id": "1",
                "type": "material_bundle",
                "attributes": {"title": "AI 시리즈", "is_published": True, "is_official": False},
            },
            "included": [
                {
                    "id": "10",
                    "type": "material",
                    "attributes": {"name": "1차시", "position": 0, "is_public": False},
                },
                {
                    "id": "11",
                    "type": "material",
                    "attributes": {"name": "2차시", "position": 1, "is_public": False},
                },
                {
                    "id": "t1",
                    "type": "tag",
                    "attributes": {"name": "AI", "domain": "category"},
                },
            ],
        }

        result = await get_bundle_detail("1")
        assert "AI 시리즈" in result
        assert "1차시" in result
        assert "2차시" in result
        assert "AI (category)" in result

    async def test_no_materials(self, mock_client):
        mock_client.get_material_bundle.return_value = {
            "data": {
                "id": "1",
                "type": "material_bundle",
                "attributes": {"title": "빈 시리즈", "is_published": False, "is_official": False},
            },
            "included": [],
        }

        result = await get_bundle_detail("1")
        assert "포함된 자료: 없음" in result


class TestManageBundle:
    async def test_create(self, mock_client):
        mock_client.create_material_bundle.return_value = make_jsonapi_response(
            "material_bundle", "1", {"title": "새 시리즈"}
        )
        result = await manage_bundle(action="create", title="새 시리즈")
        assert "생성 완료" in result
        assert "새 시리즈" in result

    async def test_create_missing_title(self, mock_client):
        result = await manage_bundle(action="create")
        assert "title은 필수" in result

    async def test_update(self, mock_client):
        mock_client.update_material_bundle.return_value = make_jsonapi_response(
            "material_bundle", "1", {"title": "수정됨"}
        )
        result = await manage_bundle(action="update", bundle_id="1", title="수정됨")
        assert "수정 완료" in result

    async def test_update_missing_bundle_id(self, mock_client):
        result = await manage_bundle(action="update")
        assert "bundle_id는 필수" in result

    async def test_update_no_changes(self, mock_client):
        result = await manage_bundle(action="update", bundle_id="1")
        assert "수정할 항목이 없습니다" in result

    async def test_delete(self, mock_client):
        mock_client.delete_material_bundle.return_value = {}
        result = await manage_bundle(action="delete", bundle_id="1")
        assert "삭제 완료" in result

    async def test_delete_missing_bundle_id(self, mock_client):
        result = await manage_bundle(action="delete")
        assert "bundle_id는 필수" in result

    async def test_invalid_action(self, mock_client):
        result = await manage_bundle(action="invalid")
        assert "유효하지 않은 action" in result
