from typing import Any

import httpx

from codle_mcp.config import settings


class CodleAPIError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Codle API error {status_code}: {detail}")


class CodleClient:
    """jce-class-rails API 클라이언트."""

    def __init__(self):
        self.base_url = settings.api_url.rstrip("/")
        self._access_token = ""
        self._refresh_token = ""
        self._auth_url = settings.auth_url.rstrip("/") if settings.auth_url else ""
        self._email = settings.email
        self._password = settings.password
        self._client_id = settings.client_id
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
            timeout=30.0,
        )

    def _can_auto_auth(self) -> bool:
        return bool(self._auth_url and self._email and self._password and self._client_id)

    async def _authenticate(self) -> None:
        """Password grant로 토큰 발급."""
        async with httpx.AsyncClient(timeout=15.0) as auth_client:
            response = await auth_client.post(
                f"{self._auth_url}/oauth/token",
                data={
                    "grant_type": "password",
                    "username": self._email,
                    "password": self._password,
                    "client_id": self._client_id,
                },
            )
            if not response.is_success:
                raise CodleAPIError(response.status_code, f"인증 실패: {response.text}")
            data = response.json()
            self._access_token = data["access_token"]
            self._refresh_token = data.get("refresh_token", "")

    async def _refresh(self) -> bool:
        """Refresh token으로 토큰 갱신. 성공 시 True."""
        if not self._refresh_token or not self._auth_url or not self._client_id:
            return False
        async with httpx.AsyncClient(timeout=15.0) as auth_client:
            response = await auth_client.post(
                f"{self._auth_url}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self._client_id,
                },
            )
            if not response.is_success:
                return False
            data = response.json()
            self._access_token = data["access_token"]
            self._refresh_token = data.get("refresh_token", self._refresh_token)
            return True

    def _auth_headers(self) -> dict[str, str]:
        if self._access_token:
            return {"Authorization": f"Bearer {self._access_token}"}
        return {}

    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        # Lazy auth: 토큰 없고 자동 인증 가능하면 첫 요청 시 발급
        if not self._access_token and self._can_auto_auth():
            await self._authenticate()

        response = await self._client.request(method, path, headers=self._auth_headers(), **kwargs)

        # 401 → refresh 시도, 실패 시 재인증
        if response.status_code == 401 and self._can_auto_auth():
            refreshed = await self._refresh()
            if not refreshed:
                await self._authenticate()
            response = await self._client.request(method, path, headers=self._auth_headers(), **kwargs)

        if not response.is_success:
            raise CodleAPIError(response.status_code, response.text)
        if response.status_code == 204:
            return {}
        return response.json()

    # --- Materials ---

    async def list_materials(self, params: dict | None = None) -> dict:
        return await self._request("GET", "/api/v1/materials", params=params)

    async def get_material(self, material_id: str, params: dict | None = None) -> dict:
        return await self._request("GET", f"/api/v1/materials/{material_id}", params=params)

    async def create_material(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/materials", json=data)

    async def update_material(self, material_id: str, data: dict) -> dict:
        return await self._request("PUT", f"/api/v1/materials/{material_id}", json=data)

    async def duplicate_material(self, material_id: str) -> dict:
        return await self._request("POST", f"/api/v1/materials/{material_id}/duplicate")

    async def delete_material(self, material_id: str) -> dict:
        return await self._request("DELETE", f"/api/v1/materials/{material_id}")

    # --- Problems ---

    async def list_problems(self, params: dict | None = None) -> dict:
        return await self._request("GET", "/api/v1/problems", params=params)

    async def get_problem(self, problem_id: str, params: dict | None = None) -> dict:
        return await self._request("GET", f"/api/v1/problems/{problem_id}", params=params)

    async def create_problem(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/problems", json=data)

    async def update_problem(self, problem_id: str, data: dict) -> dict:
        return await self._request("PUT", f"/api/v1/problems/{problem_id}", json=data)

    async def duplicate_problem(self, problem_id: str) -> dict:
        return await self._request("POST", f"/api/v1/problems/{problem_id}/duplicate")

    # --- Activities ---

    async def create_activity(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/activities", json=data)

    async def get_activity(self, activity_id: str, params: dict | None = None) -> dict:
        return await self._request("GET", f"/api/v1/activities/{activity_id}", params=params)

    async def update_activity(self, activity_id: str, data: dict) -> dict:
        return await self._request("PUT", f"/api/v1/activities/{activity_id}", json=data)

    async def delete_activity(self, activity_id: str) -> dict:
        return await self._request("DELETE", f"/api/v1/activities/{activity_id}")

    async def duplicate_activity(self, activity_id: str) -> dict:
        return await self._request("POST", f"/api/v1/activities/{activity_id}/duplicate")

    async def do_many_activities(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/activities/do_many", json=data)

    # --- Material Bundles ---

    async def list_material_bundles(self, params: dict | None = None) -> dict:
        return await self._request("GET", "/api/v1/material_bundles", params=params)

    async def get_material_bundle(self, bundle_id: str, params: dict | None = None) -> dict:
        return await self._request("GET", f"/api/v1/material_bundles/{bundle_id}", params=params)

    async def create_material_bundle(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/material_bundles", json=data)

    async def update_material_bundle(self, bundle_id: str, data: dict) -> dict:
        return await self._request("PUT", f"/api/v1/material_bundles/{bundle_id}", json=data)

    async def delete_material_bundle(self, bundle_id: str) -> dict:
        return await self._request("DELETE", f"/api/v1/material_bundles/{bundle_id}")

    async def duplicate_material_bundle(self, bundle_id: str) -> dict:
        return await self._request("POST", f"/api/v1/material_bundles/{bundle_id}/duplicate")

    # --- Tags ---

    async def list_tags(self, params: dict | None = None) -> dict:
        return await self._request("GET", "/api/v1/tags", params=params)

    # --- Problem Collections ---

    async def list_problem_collections(self, params: dict | None = None) -> dict:
        return await self._request("GET", "/api/v1/problem_collections", params=params)

    # --- Quiz Activities ---

    async def create_quiz_activity(self, data: dict) -> dict:
        return await self._request("POST", "/api/v1/quiz_activities", json=data)

    async def update_quiz_activity(self, activity_id: str, data: dict) -> dict:
        return await self._request("PUT", f"/api/v1/quiz_activities/{activity_id}", json=data)

    async def close(self):
        await self._client.aclose()


client = CodleClient()
