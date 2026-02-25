import pytest

from codle_mcp.api.client import CodleAPIError
from codle_mcp.tools.problems import (
    _pascal_to_snake,
    manage_problem_collections,
    search_problems,
    upsert_problem,
)

from .conftest import make_jsonapi_list_response, make_jsonapi_response


# --- _pascal_to_snake (problems.py duplicate) ---


class TestPascalToSnakeProblems:
    def test_quiz_activity(self):
        assert _pascal_to_snake("QuizActivity") == "quiz_activity"

    def test_sheet_activity(self):
        assert _pascal_to_snake("SheetActivity") == "sheet_activity"


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


class TestManageProblemCollectionsCreate:
    async def test_successful_create(self, mock_client):
        """정상: activity에서 activitiable_id 추출 → PC 생성 → 문제 연결."""
        # get_activity 응답 (include=activitiable)
        mock_client.get_activity.return_value = {
            "data": {
                "id": "100",
                "type": "activity",
                "attributes": {"name": "퀴즈"},
                "relationships": {
                    "activitiable": {"data": {"type": "quiz_activity", "id": "99"}},
                },
            },
        }
        # create_problem_collection 응답
        mock_client.create_problem_collection.return_value = make_jsonapi_response(
            "problem_collection", "pc-1", {"name": "퀴즈"}
        )
        mock_client.do_many_problem_collections_problems.return_value = {}

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1", "p2"]
        )
        assert "생성 및 문제 연결 완료" in result
        assert "문제 2개" in result

        # PC 생성 payload에 quiz_activity_id 포함 확인
        pc_payload = mock_client.create_problem_collection.call_args[0][0]
        pc_attrs = pc_payload["data"]["attributes"]
        assert pc_attrs["quiz_activity_id"] == "99"

    async def test_sheet_activity_owner(self, mock_client):
        """SheetActivity → owner는 sheet_activity_id."""
        mock_client.get_activity.return_value = {
            "data": {
                "id": "100",
                "type": "activity",
                "attributes": {},
                "relationships": {
                    "activitiable": {"data": {"type": "sheet_activity", "id": "88"}},
                },
            },
        }
        mock_client.create_problem_collection.return_value = make_jsonapi_response(
            "problem_collection", "pc-2", {}
        )
        mock_client.do_many_problem_collections_problems.return_value = {}

        await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        pc_payload = mock_client.create_problem_collection.call_args[0][0]
        assert "sheet_activity_id" in pc_payload["data"]["attributes"]

    async def test_missing_activitiable(self, mock_client):
        """activitiable 관계 없음 → 에러."""
        mock_client.get_activity.return_value = {
            "data": {
                "id": "100",
                "type": "activity",
                "attributes": {},
                "relationships": {},
            },
        }

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "activitiable_id를 찾을 수 없습니다" in result

    async def test_missing_activity_id(self, mock_client):
        result = await manage_problem_collections(action="create", problem_ids=["p1"])
        assert "activity_id는 필수" in result

    async def test_missing_problem_ids(self, mock_client):
        result = await manage_problem_collections(action="create", activity_id="1")
        assert "problem_ids는 필수" in result

    async def test_link_failure_partial_success(self, mock_client):
        """PC 생성 성공, 문제 연결 실패 → 부분 성공 메시지."""
        mock_client.get_activity.return_value = {
            "data": {
                "id": "100",
                "type": "activity",
                "attributes": {},
                "relationships": {
                    "activitiable": {"data": {"type": "quiz_activity", "id": "99"}},
                },
            },
        }
        mock_client.create_problem_collection.return_value = make_jsonapi_response(
            "problem_collection", "pc-1", {}
        )
        mock_client.do_many_problem_collections_problems.side_effect = CodleAPIError(422, "Link failed")

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "pc-1" in result
        assert "문제 연결 실패" in result
        assert "add_problems" in result

    async def test_pc_creation_failure(self, mock_client):
        """PC 생성 실패."""
        mock_client.get_activity.return_value = {
            "data": {
                "id": "100",
                "type": "activity",
                "attributes": {},
                "relationships": {
                    "activitiable": {"data": {"type": "quiz_activity", "id": "99"}},
                },
            },
        }
        mock_client.create_problem_collection.side_effect = CodleAPIError(422, "Invalid")

        result = await manage_problem_collections(
            action="create", activity_id="100", problem_ids=["p1"]
        )
        assert "ProblemCollection 생성 실패" in result


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


class TestManageProblemCollectionsDelete:
    async def test_successful_delete(self, mock_client):
        mock_client.delete_problem_collection.return_value = {}
        result = await manage_problem_collections(
            action="delete", problem_collection_id="pc-1"
        )
        assert "삭제 완료" in result

    async def test_delete_error(self, mock_client):
        mock_client.delete_problem_collection.side_effect = CodleAPIError(404, "Not found")
        result = await manage_problem_collections(
            action="delete", problem_collection_id="pc-1"
        )
        assert "삭제 실패" in result

    async def test_missing_pc_id(self, mock_client):
        result = await manage_problem_collections(action="delete")
        assert "problem_collection_id는 필수" in result


class TestManageProblemCollectionsInvalidAction:
    async def test_invalid_action(self, mock_client):
        result = await manage_problem_collections(action="invalid")
        assert "유효하지 않은 action" in result
