from unittest.mock import AsyncMock

import pytest

from codle_mcp.api.client import CodleAPIError
from codle_mcp.tools.activities import (
    _find_tail_activity,
    _pascal_to_snake,
    manage_activities,
    set_activity_branch,
)

from .conftest import make_jsonapi_response


# --- _pascal_to_snake ---


class TestPascalToSnake:
    def test_quiz_activity(self):
        assert _pascal_to_snake("QuizActivity") == "quiz_activity"

    def test_html_activity(self):
        assert _pascal_to_snake("HtmlActivity") == "html_activity"

    def test_single_word(self):
        assert _pascal_to_snake("Activity") == "activity"

    def test_ai_recommend(self):
        assert _pascal_to_snake("AiRecommendQuizActivity") == "ai_recommend_quiz_activity"


# --- _find_tail_activity ---


class TestFindTailActivity:
    async def test_empty_material(self, mock_client):
        """활동이 없는 material → None."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],
        }
        result = await _find_tail_activity("1", "new-1")
        assert result is None

    async def test_linear_chain(self, mock_client):
        """A→B→C 체인 → C가 tail."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {"id": "act-1", "type": "activity", "attributes": {}},
                {"id": "act-2", "type": "activity", "attributes": {}},
                {"id": "act-3", "type": "activity", "attributes": {}},
                {
                    "id": "t-1",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "act-1", "after_activity_id": "act-2"},
                },
                {
                    "id": "t-2",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "act-2", "after_activity_id": "act-3"},
                },
            ],
        }
        result = await _find_tail_activity("1", "new-1")
        assert result == "act-3"

    async def test_branch_multiple_tails(self, mock_client):
        """A→B, A→C 분기 → tail이 2개 → None."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {"id": "act-1", "type": "activity", "attributes": {}},
                {"id": "act-2", "type": "activity", "attributes": {}},
                {"id": "act-3", "type": "activity", "attributes": {}},
                {
                    "id": "t-1",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "act-1", "after_activity_id": "act-2"},
                },
                {
                    "id": "t-2",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "act-1", "after_activity_id": "act-3"},
                },
            ],
        }
        result = await _find_tail_activity("1", "new-1")
        assert result is None

    async def test_single_activity_no_transitions(self, mock_client):
        """활동 1개, transition 없음 → 해당 활동이 tail."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {"id": "act-1", "type": "activity", "attributes": {}},
            ],
        }
        result = await _find_tail_activity("1", "new-1")
        assert result == "act-1"

    async def test_exclude_id(self, mock_client):
        """exclude_id는 기존 활동에서 제외됨."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {"id": "act-1", "type": "activity", "attributes": {}},
                {"id": "new-1", "type": "activity", "attributes": {}},
            ],
        }
        result = await _find_tail_activity("1", "new-1")
        assert result == "act-1"


# --- manage_activities ---


class TestManageActivitiesCreate:
    async def test_missing_required_params(self, mock_client):
        result = await manage_activities(action="create")
        assert "필수" in result

    async def test_invalid_activity_type(self, mock_client):
        result = await manage_activities(
            action="create", material_id="1", name="test", activity_type="InvalidType"
        )
        assert "유효하지 않은 activity_type" in result

    async def test_successful_create(self, mock_client):
        """정상 생성: activitiable → activity → transition."""
        # activitiable 생성 응답
        mock_client._request.return_value = make_jsonapi_response(
            "quiz_activity", "99", {"is_exam": False}
        )
        # activity 생성 응답
        mock_client.create_activity.return_value = make_jsonapi_response(
            "activity", "100", {"name": "테스트", "depth": 0, "material_id": "1"},
            relationships={"activitiable": {"data": {"type": "quiz_activity", "id": "99"}}},
        )
        # _find_tail_activity용 get_material 응답 (활동 없음)
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],
        }

        result = await manage_activities(
            action="create", material_id="1", name="테스트", activity_type="QuizActivity"
        )

        assert "100" in result
        assert "생성 완료" in result
        # activitiable 생성 API 호출 확인
        mock_client._request.assert_called_once_with(
            "POST", "/api/v1/quiz_activities", json={"data": {"type": "quiz_activity", "attributes": {}}}
        )
        # activity payload에 activitiable_id 포함 확인
        call_args = mock_client.create_activity.call_args[0][0]
        attrs = call_args["data"]["attributes"]
        assert attrs["activitiable_type"] == "QuizActivity"
        assert attrs["activitiable_id"] == "99"

    async def test_activitiable_no_id_in_response(self, mock_client):
        """activitiable 응답에 ID 없음 → 에러."""
        mock_client._request.return_value = {"data": {"type": "quiz_activity", "attributes": {}}}

        result = await manage_activities(
            action="create", material_id="1", name="test", activity_type="QuizActivity"
        )
        assert "응답에 id 없음" in result

    async def test_activitiable_api_error(self, mock_client):
        """A1 버그: activitiable 생성 API 에러 → 친화적 메시지 반환."""
        mock_client._request.side_effect = CodleAPIError(422, "Validation failed: name is required")

        result = await manage_activities(
            action="create", material_id="1", name="test", activity_type="HtmlActivity"
        )
        assert "activitiable(HtmlActivity) 생성 실패" in result
        assert "Validation failed" in result

    async def test_branch_from_skips_transition(self, mock_client):
        """branch_from 지정 시 transition 생성 스킵."""
        mock_client._request.return_value = make_jsonapi_response("quiz_activity", "99")
        mock_client.create_activity.return_value = make_jsonapi_response(
            "activity", "100", {"name": "분기활동", "depth": 0, "material_id": "1"}
        )

        result = await manage_activities(
            action="create",
            material_id="1",
            name="분기활동",
            activity_type="QuizActivity",
            branch_from="50",
        )
        assert "set_activity_branch" in result
        # get_material (tail 탐색) 호출하지 않아야 함
        mock_client.get_material.assert_not_called()

    async def test_auto_chain_to_tail(self, mock_client):
        """기존 활동이 있으면 tail → 새 활동으로 transition 생성."""
        mock_client._request.return_value = make_jsonapi_response("quiz_activity", "99")
        mock_client.create_activity.return_value = make_jsonapi_response(
            "activity", "200", {"name": "두번째", "depth": 0, "material_id": "1"}
        )
        # tail = act-1
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {"id": "act-1", "type": "activity", "attributes": {}},
            ],
        }

        result = await manage_activities(
            action="create", material_id="1", name="두번째", activity_type="QuizActivity"
        )
        assert "act-1 → 200 연결됨" in result
        mock_client.create_activity_transition.assert_called_once()


class TestManageActivitiesUpdate:
    async def test_missing_activity_id(self, mock_client):
        result = await manage_activities(action="update")
        assert "activity_id는 필수" in result

    async def test_default_depth_still_updates(self, mock_client):
        """depth 기본값(0)이 None이 아니므로 update 진행됨."""
        mock_client.update_activity.return_value = make_jsonapi_response(
            "activity", "1", {"name": "test", "depth": 0}
        )
        result = await manage_activities(action="update", activity_id="1")
        assert "수정 완료" in result

    async def test_update_name(self, mock_client):
        mock_client.update_activity.return_value = make_jsonapi_response(
            "activity", "1", {"name": "새이름", "depth": 0}
        )
        result = await manage_activities(action="update", activity_id="1", name="새이름")
        assert "수정 완료" in result


class TestManageActivitiesDelete:
    async def test_missing_activity_id(self, mock_client):
        result = await manage_activities(action="delete")
        assert "activity_id는 필수" in result

    async def test_successful_delete(self, mock_client):
        mock_client.delete_activity.return_value = {}
        result = await manage_activities(action="delete", activity_id="1")
        assert "삭제 완료" in result

    async def test_delete_api_error(self, mock_client):
        mock_client.delete_activity.side_effect = CodleAPIError(404, "Not found")
        result = await manage_activities(action="delete", activity_id="999")
        assert "삭제 실패" in result


class TestManageActivitiesInvalidAction:
    async def test_invalid_action(self, mock_client):
        result = await manage_activities(action="invalid")
        assert "유효하지 않은 action" in result


# --- set_activity_branch ---


class TestSetActivityBranch:
    async def test_successful_branch_two_levels(self, mock_client):
        """mid + low (2개) → do_many 호출."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],  # 기존 transition 없음
        }
        mock_client.do_many_activity_transitions.return_value = {}

        result = await set_activity_branch(
            material_id="1",
            branch_from="50",
            mid_activity_id="51",
            low_activity_id="52",
        )
        assert "갈림길 설정 완료" in result
        assert "mid=51" in result
        assert "low=52" in result

        call_args = mock_client.do_many_activity_transitions.call_args[0][0]
        assert len(call_args["data_to_create"]) == 2
        assert "data_to_destroy" not in call_args

    async def test_three_levels(self, mock_client):
        """mid + low + high (3개)."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],
        }
        mock_client.do_many_activity_transitions.return_value = {}

        result = await set_activity_branch(
            material_id="1",
            branch_from="50",
            mid_activity_id="51",
            low_activity_id="52",
            high_activity_id="53",
        )
        assert "갈림길 설정 완료" in result
        call_args = mock_client.do_many_activity_transitions.call_args[0][0]
        assert len(call_args["data_to_create"]) == 3

    async def test_only_mid_fails(self, mock_client):
        """mid만 (1개) → 최소 2개 에러."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],
        }

        result = await set_activity_branch(
            material_id="1",
            branch_from="50",
            mid_activity_id="51",
        )
        assert "최소 2개" in result
        mock_client.do_many_activity_transitions.assert_not_called()

    async def test_existing_transitions_destroyed(self, mock_client):
        """기존 transition이 있으면 data_to_destroy에 포함."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [
                {
                    "id": "old-t-1",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "50", "after_activity_id": "60"},
                },
                {
                    "id": "other-t",
                    "type": "activity_transition",
                    "attributes": {"before_activity_id": "99", "after_activity_id": "100"},
                },
            ],
        }
        mock_client.do_many_activity_transitions.return_value = {}

        result = await set_activity_branch(
            material_id="1",
            branch_from="50",
            mid_activity_id="51",
            low_activity_id="52",
        )
        assert "기존 transition 1개 제거" in result
        call_args = mock_client.do_many_activity_transitions.call_args[0][0]
        assert call_args["data_to_destroy"] == [{"id": "old-t-1"}]

    async def test_api_error(self, mock_client):
        """do_many API 에러 처리."""
        mock_client.get_material.return_value = {
            "data": {"id": "1", "type": "material", "attributes": {}},
            "included": [],
        }
        mock_client.do_many_activity_transitions.side_effect = CodleAPIError(422, "Invalid")

        result = await set_activity_branch(
            material_id="1",
            branch_from="50",
            mid_activity_id="51",
            low_activity_id="52",
        )
        assert "갈림길 설정 실패" in result
