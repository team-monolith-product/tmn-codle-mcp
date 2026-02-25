from unittest.mock import MagicMock

from codle_mcp.api.client import CodleClient


class TestExtractErrorDetail:
    """A7: HTML 에러 응답 요약 처리."""

    def test_html_error_extracts_h2(self):
        response = MagicMock()
        response.status_code = 404
        response.headers = {"content-type": "text/html; charset=utf-8"}
        response.text = """
        <html><body>
        <h2>No route matches [POST] "/api/v1/problem_collections"</h2>
        <p>Some long debug info...</p>
        </body></html>
        """
        result = CodleClient._extract_error_detail(response)
        assert "No route matches" in result
        assert "HTML 에러 응답" in result
        assert len(result) < 200

    def test_html_error_extracts_h1(self):
        response = MagicMock()
        response.status_code = 500
        response.headers = {"content-type": "text/html"}
        response.text = '<html><h1>Internal Server Error</h1></html>'
        result = CodleClient._extract_error_detail(response)
        assert "Internal Server Error" in result

    def test_html_error_no_heading(self):
        response = MagicMock()
        response.status_code = 500
        response.headers = {"content-type": "text/html"}
        response.text = "<html><body>Something went wrong</body></html>"
        result = CodleClient._extract_error_detail(response)
        assert "알 수 없는 에러" in result

    def test_json_error_passthrough(self):
        response = MagicMock()
        response.status_code = 422
        response.headers = {"content-type": "application/vnd.api+json"}
        response.text = '{"errors": [{"detail": "Validation failed"}]}'
        result = CodleClient._extract_error_detail(response)
        assert "Validation failed" in result

    def test_long_json_error_truncated(self):
        response = MagicMock()
        response.status_code = 422
        response.headers = {"content-type": "application/json"}
        response.text = "x" * 2000
        result = CodleClient._extract_error_detail(response)
        assert len(result) < 1100
        assert result.endswith("...")
