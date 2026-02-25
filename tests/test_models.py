from codle_mcp.api.models import (
    build_jsonapi_payload,
    extract_attributes,
    extract_included,
    extract_list,
    extract_single,
    format_bundle_summary,
    format_material_summary,
    format_problem_summary,
    snake_to_pascal,
)


class TestBuildJsonapiPayload:
    def test_basic(self):
        result = build_jsonapi_payload("activities", {"name": "test"})
        assert result == {"data": {"type": "activities", "attributes": {"name": "test"}}}

    def test_none_values_excluded(self):
        result = build_jsonapi_payload("activities", {"name": "test", "depth": None})
        assert result["data"]["attributes"] == {"name": "test"}

    def test_with_id(self):
        result = build_jsonapi_payload("activities", {"name": "test"}, resource_id="42")
        assert result["data"]["id"] == "42"

    def test_without_id(self):
        result = build_jsonapi_payload("activities", {"name": "test"})
        assert "id" not in result["data"]

    def test_with_relationships(self):
        rels = {"activitiable": {"data": {"type": "quiz_activity", "id": "99"}}}
        result = build_jsonapi_payload("activities", {"name": "test"}, relationships=rels)
        assert result["data"]["relationships"] == rels

    def test_without_relationships(self):
        result = build_jsonapi_payload("activities", {"name": "test"})
        assert "relationships" not in result["data"]

    def test_false_and_zero_preserved(self):
        result = build_jsonapi_payload("problems", {"is_public": False, "timeout": 0})
        assert result["data"]["attributes"] == {"is_public": False, "timeout": 0}


class TestExtractAttributes:
    def test_basic(self):
        resource = {"id": "1", "attributes": {"name": "test", "depth": 0}}
        result = extract_attributes(resource)
        assert result == {"id": "1", "name": "test", "depth": 0}

    def test_missing_attributes(self):
        resource = {"id": "1"}
        result = extract_attributes(resource)
        assert result == {"id": "1"}

    def test_missing_id(self):
        resource = {"attributes": {"name": "test"}}
        result = extract_attributes(resource)
        assert result == {"id": None, "name": "test"}


class TestExtractSingle:
    def test_basic(self):
        response = {"data": {"id": "1", "type": "activity", "attributes": {"name": "A"}}}
        result = extract_single(response)
        assert result == {"id": "1", "name": "A"}

    def test_empty_data(self):
        result = extract_single({"data": {}})
        assert result == {"id": None}

    def test_missing_data(self):
        result = extract_single({})
        assert result == {"id": None}


class TestExtractList:
    def test_basic(self):
        response = {
            "data": [
                {"id": "1", "type": "activity", "attributes": {"name": "A"}},
                {"id": "2", "type": "activity", "attributes": {"name": "B"}},
            ]
        }
        result = extract_list(response)
        assert len(result) == 2
        assert result[0] == {"id": "1", "name": "A"}
        assert result[1] == {"id": "2", "name": "B"}

    def test_empty_list(self):
        result = extract_list({"data": []})
        assert result == []

    def test_missing_data(self):
        result = extract_list({})
        assert result == []


class TestExtractIncluded:
    def test_filter_by_type(self):
        response = {
            "included": [
                {"id": "1", "type": "activity", "attributes": {"name": "A"}},
                {"id": "2", "type": "tag", "attributes": {"name": "T"}},
                {"id": "3", "type": "activity", "attributes": {"name": "B"}},
            ]
        }
        result = extract_included(response, "activity")
        assert len(result) == 2
        assert result[0]["name"] == "A"
        assert result[1]["name"] == "B"

    def test_no_matches(self):
        response = {"included": [{"id": "1", "type": "tag", "attributes": {}}]}
        result = extract_included(response, "activity")
        assert result == []

    def test_missing_included(self):
        result = extract_included({}, "activity")
        assert result == []


class TestSnakeToPascal:
    def test_quiz_activity(self):
        assert snake_to_pascal("quiz_activity") == "QuizActivity"

    def test_html_activity(self):
        assert snake_to_pascal("html_activity") == "HtmlActivity"

    def test_single_word(self):
        assert snake_to_pascal("activity") == "Activity"

    def test_three_words(self):
        assert snake_to_pascal("ai_recommend_quiz_activity") == "AiRecommendQuizActivity"


class TestFormatSummaries:
    def test_material_public(self):
        result = format_material_summary({"id": "1", "name": "Test", "is_public": True})
        assert result == "- [1] Test (공개)"

    def test_material_private(self):
        result = format_material_summary({"id": "1", "name": "Test", "is_public": False})
        assert result == "- [1] Test (비공개)"

    def test_material_no_name(self):
        result = format_material_summary({"id": "1"})
        assert "(무제)" in result

    def test_problem(self):
        result = format_problem_summary({"id": "1", "title": "Q1", "problem_type": "quiz"})
        assert result == "- [1] Q1 (type: quiz)"

    def test_bundle_published(self):
        result = format_bundle_summary({"id": "1", "title": "S1", "is_published": True})
        assert result == "- [1] S1 (게시됨)"

    def test_bundle_unpublished(self):
        result = format_bundle_summary({"id": "1", "title": "S1", "is_published": False})
        assert result == "- [1] S1 (미게시)"
