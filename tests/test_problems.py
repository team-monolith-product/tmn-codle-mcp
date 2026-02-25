import json

import pytest

from codle_mcp.api.client import CodleAPIError
from codle_mcp.tools.problems import (
    manage_problem_collections,
    search_problems,
    upsert_problem,
)

from .conftest import make_jsonapi_list_response, make_jsonapi_response


# --- upsert_problem ---


class TestUpsertProblemCreate:
    async def test_successful_create(self, mock_client):
        mock_client.create_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1", "problem_type": "quiz"}
        )

        result = await upsert_problem(
            title="Q1",
            problem_type="quiz",
            blocks={"root": {"children": []}},
        )
        assert "생성 완료" in result
        assert "Q1" in result

        # problem_type이 attrs에 포함되어야 함
        call_args = mock_client.create_problem.call_args[0][0]
        assert call_args["data"]["attributes"]["problem_type"] == "quiz"

    async def test_invalid_problem_type(self, mock_client):
        result = await upsert_problem(title="Q1", problem_type="invalid", blocks={})
        assert "유효하지 않은 problem_type" in result

    async def test_slash_in_title(self, mock_client):
        result = await upsert_problem(title="[O/X] 문제", problem_type="quiz", blocks={})
        assert "/" in result
        assert "사용할 수 없습니다" in result

    async def test_blocks_required_on_create(self, mock_client):
        result = await upsert_problem(title="Q1", problem_type="quiz")
        assert "blocks는 필수" in result

    async def test_blocks_optional_on_update(self, mock_client):
        """수정 시 blocks 없어도 OK."""
        mock_client.update_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1 수정"}
        )
        result = await upsert_problem(title="Q1 수정", problem_type="quiz", problem_id="1")
        assert "수정 완료" in result


class TestUpsertProblemUpdate:
    async def test_successful_update(self, mock_client):
        mock_client.update_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1 수정", "problem_type": "quiz"}
        )

        result = await upsert_problem(
            title="Q1 수정",
            problem_type="quiz",
            problem_id="1",
            blocks={"root": {"children": []}},
        )
        assert "수정 완료" in result

        # update 시 problem_type은 attrs에 미포함
        call_args = mock_client.update_problem.call_args[0][1]
        assert "problem_type" not in call_args["data"]["attributes"]

    async def test_update_includes_is_public_and_timeout(self, mock_client):
        mock_client.update_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1"}
        )

        await upsert_problem(title="Q1", problem_type="quiz", problem_id="1")
        call_args = mock_client.update_problem.call_args[0][1]
        attrs = call_args["data"]["attributes"]
        assert attrs["is_public"] is False
        assert attrs["timeout"] == 1


class TestUpsertProblemCommentary:
    """B5: commentary 파라미터 타입 처리."""

    async def test_commentary_dict(self, mock_client):
        """dict로 전달 → 그대로 사용."""
        mock_client.create_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1"}
        )
        commentary = {"root": {"children": [{"text": "해설"}]}}
        await upsert_problem(
            title="Q1", problem_type="quiz", blocks={"root": {}}, commentary=commentary
        )
        call_args = mock_client.create_problem.call_args[0][0]
        assert call_args["data"]["attributes"]["commentary"] == commentary

    async def test_commentary_json_string(self, mock_client):
        """JSON string으로 전달 → dict로 파싱."""
        mock_client.create_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1"}
        )
        commentary_dict = {"root": {"children": []}}
        await upsert_problem(
            title="Q1",
            problem_type="quiz",
            blocks={"root": {}},
            commentary=json.dumps(commentary_dict),
        )
        call_args = mock_client.create_problem.call_args[0][0]
        assert call_args["data"]["attributes"]["commentary"] == commentary_dict

    async def test_commentary_invalid_string(self, mock_client):
        """파싱 불가 string → 그대로 전달 (API에서 에러 처리)."""
        mock_client.create_problem.return_value = make_jsonapi_response(
            "problem", "1", {"title": "Q1"}
        )
        await upsert_problem(
            title="Q1",
            problem_type="quiz",
            blocks={"root": {}},
            commentary="just a string",
        )
        call_args = mock_client.create_problem.call_args[0][0]
        assert call_args["data"]["attributes"]["commentary"] == "just a string"


# --- search_problems ---


class TestSearchProblems:
    async def test_basic_search(self, mock_client):
        mock_client.list_problems.return_value = make_jsonapi_list_response(
            "problem",
            [{"id": "1", "title": "Q1", "problem_type": "quiz"}],
        )

        result = await search_problems(query="Q1")
        assert "Q1" in result
        call_params = mock_client.list_problems.call_args[0][0]
        assert call_params["filter[query]"] == "Q1"
        assert call_params["filter[is_exam]"] == "false"

    async def test_empty_results(self, mock_client):
        mock_client.list_problems.return_value = {"data": []}
        result = await search_problems()
        assert "검색 결과가 없습니다" in result


# --- manage_problem_collections ---


def _activity_with_pc(activity_id="100", pc_id="pc-1"):
    """Activity 응답에 problem_collections relationship 포함."""
    return {
        "data": {
            "type": "activity",
            "id": activity_id,
            "attributes": {"name": "퀴즈 활동"},
            "relationships": {
                "problem_collections": {
                    "data": [{"type": "problem_collection", "id": pc_id}]
                }
            },
        }
    }


def _activity_without_pc(activity_id="100"):
    """Activity 응답에 problem_collections 없음."""
    return {
        "data": {
            "type": "activity",
            "id": activity_id,
            "attributes": {"name": "영상 활동"},
            "relationships": {
                "problem_collections": {"data": []}
            },
        }
    }


class TestManageProblemCollectionsCreate:
    async def test_successful_create(self, mock_client):
        """정상: activity에서 auto-created PC 찾아서 문제 연결."""
        mock_client.get_activity.return_value = _activity_with_pc("100", "pc-1")
        mock_client.do_many_problem_collections_problems.return_value = {}

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1", "p2"]
        )
        assert "생성 및 문제 연결 완료" in result
        assert "문제 2개" in result
        assert "pc-1" in result

        # get_activity에 include=problem_collections.pcps 파라미터 확인
        call_args = mock_client.get_activity.call_args
        assert call_args[0][0] == "100"
        assert call_args[0][1].get("include") == "problem_collections.pcps"

        # do_many payload 형식 확인 (Rails DoMany concern 형식)
        do_many_payload = mock_client.do_many_problem_collections_problems.call_args[0][0]
        assert "data_to_create" in do_many_payload
        items = do_many_payload["data_to_create"]
        assert len(items) == 2
        assert items[0]["attributes"]["problem_collection_id"] == "pc-1"
        assert items[0]["attributes"]["problem_id"] == "p1"
        assert items[0]["attributes"]["position"] == 0
        assert items[0]["attributes"]["point"] == 1
        assert items[0]["attributes"]["is_required"] is True
        assert items[1]["attributes"]["problem_id"] == "p2"
        assert items[1]["attributes"]["position"] == 1

    async def test_missing_activity_id(self, mock_client):
        result = await manage_problem_collections(action="create", problem_ids=["p1"])
        assert "activity_id는 필수" in result

    async def test_missing_problem_ids(self, mock_client):
        result = await manage_problem_collections(action="create", activity_id="1")
        assert "problem_ids는 필수" in result

    async def test_no_problem_collection(self, mock_client):
        """활동에 ProblemCollection이 없으면 에러."""
        mock_client.get_activity.return_value = _activity_without_pc("100")

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "ProblemCollection이 없습니다" in result

    async def test_activity_fetch_failure(self, mock_client):
        """활동 조회 실패."""
        mock_client.get_activity.side_effect = CodleAPIError(404, "Not found")

        result = await manage_problem_collections(
            action="create", activity_id="999", problem_ids=["p1"]
        )
        assert "활동 조회 실패" in result

    async def test_link_failure_partial_success(self, mock_client):
        """PC 발견, 문제 연결 실패 → 부분 성공 메시지."""
        mock_client.get_activity.return_value = _activity_with_pc("100", "pc-1")
        mock_client.do_many_problem_collections_problems.side_effect = CodleAPIError(422, "Link failed")

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "pc-1" in result
        assert "문제 연결 실패" in result
        assert "add_problems" in result

    async def test_single_pc_object(self, mock_client):
        """PC relationship이 단일 객체(list가 아닌)인 경우."""
        resp = {
            "data": {
                "type": "activity",
                "id": "100",
                "attributes": {},
                "relationships": {
                    "problem_collections": {
                        "data": {"type": "problem_collection", "id": "pc-single"}
                    }
                },
            }
        }
        mock_client.get_activity.return_value = resp
        mock_client.do_many_problem_collections_problems.return_value = {}

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "pc-single" in result
        assert "생성 및 문제 연결 완료" in result


class TestManageProblemCollectionsAddProblems:
    async def test_successful_add(self, mock_client):
        mock_client.do_many_problem_collections_problems.return_value = {}

        result = await manage_problem_collections(
            action="add_problems", problem_collection_id="pc-1", problem_ids=["p1", "p2"]
        )
        assert "문제 연결 완료" in result
        assert "문제 2개" in result

    async def test_missing_pc_id(self, mock_client):
        result = await manage_problem_collections(action="add_problems", problem_ids=["p1"])
        assert "problem_collection_id는 필수" in result

    async def test_missing_problem_ids(self, mock_client):
        result = await manage_problem_collections(
            action="add_problems", problem_collection_id="pc-1"
        )
        assert "problem_ids는 필수" in result


class TestManageProblemCollectionsInvalidAction:
    async def test_invalid_action(self, mock_client):
        result = await manage_problem_collections(action="invalid")
        assert "유효하지 않은 action" in result

    async def test_delete_is_invalid(self, mock_client):
        """delete action은 더 이상 지원하지 않음."""
        result = await manage_problem_collections(action="delete")
        assert "유효하지 않은 action" in result
