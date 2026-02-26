import { config } from "../config.js";
import { logger } from "../logger.js";
import { CodleAPIError, extractErrorDetail } from "./errors.js";

export class CodleClient {
  private baseUrl: string;
  private accessToken = "";
  private refreshToken = "";
  userId = "";
  private authUrl: string;
  private email: string;
  private password: string;
  private clientId: string;

  constructor() {
    this.baseUrl = config.apiUrl;
    this.authUrl = config.authUrl;
    this.email = config.email;
    this.password = config.password;
    this.clientId = config.clientId;
  }

  private canAutoAuth(): boolean {
    return !!(this.authUrl && this.email && this.password && this.clientId);
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.authUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        username: this.email,
        password: this.password,
        client_id: this.clientId,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error("인증 실패: %d %s", response.status, text.slice(0, 200));
      throw new CodleAPIError(response.status, `인증 실패: ${text}`);
    }
    const data = (await response.json()) as Record<string, string>;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || "";
    logger.info("인증 성공 (email=%s)", this.email);
    await this.fetchUserId();
  }

  private async fetchUserId(): Promise<void> {
    if (!this.accessToken || !this.authUrl) return;
    const response = await fetch(`${this.authUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      this.userId = String(data.id || "");
    }
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshToken || !this.authUrl || !this.clientId) return false;
    const response = await fetch(`${this.authUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
      }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as Record<string, string>;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    return true;
  }

  private authHeaders(): Record<string, string> {
    if (this.accessToken) {
      return { Authorization: `Bearer ${this.accessToken}` };
    }
    return {};
  }

  async ensureAuth(): Promise<void> {
    if (!this.accessToken && this.canAutoAuth()) {
      await this.authenticate();
    }
  }

  static extractErrorDetailStatic(
    statusCode: number,
    contentType: string,
    text: string
  ): string {
    return extractErrorDetail(statusCode, contentType, text);
  }

  private logRequest(
    method: string,
    path: string,
    params?: Record<string, string | number>,
    body?: unknown
  ): void {
    const parts = [`${method} ${path}`];
    if (params) parts.push(`params=${JSON.stringify(params)}`);
    if (body) {
      let bodyStr = JSON.stringify(body);
      if (bodyStr.length > 500) bodyStr = bodyStr.slice(0, 500) + "...";
      parts.push(`body=${bodyStr}`);
    }
    logger.debug(parts.join(" "));
  }

  async request(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number | boolean>;
      json?: unknown;
    }
  ): Promise<Record<string, unknown>> {
    await this.ensureAuth();

    const { params, json } = options ?? {};
    this.logRequest(
      method,
      path,
      params as Record<string, string | number>,
      json
    );

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        qs.set(k, String(v));
      }
      url += `?${qs.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        ...this.authHeaders(),
      },
    };
    if (json) fetchOptions.body = JSON.stringify(json);

    let response = await fetch(url, fetchOptions);

    if (response.status === 401 && this.canAutoAuth()) {
      logger.info("401 → 토큰 갱신 시도");
      const refreshed = await this.refresh();
      if (!refreshed) await this.authenticate();
      fetchOptions.headers = {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        ...this.authHeaders(),
      };
      response = await fetch(url, fetchOptions);
    }

    if (!response.ok) {
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const detail = extractErrorDetail(response.status, contentType, text);
      logger.warn(
        "%s %s → %d: %s",
        method,
        path,
        response.status,
        detail.slice(0, 300)
      );
      throw new CodleAPIError(response.status, detail);
    }

    logger.debug("%s %s → %d", method, path, response.status);
    if (response.status === 204) return {};
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0") return {};
    return (await response.json()) as Record<string, unknown>;
  }

  // --- Materials ---
  async listMaterials(
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/materials", { params });
  }

  async getMaterial(
    materialId: string,
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/materials/${materialId}`, { params });
  }

  async createMaterial(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/materials", { json: data });
  }

  async updateMaterial(
    materialId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/materials/${materialId}`, {
      json: data,
    });
  }

  async duplicateMaterial(
    materialId: string
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/api/v1/materials/${materialId}/duplicate`);
  }

  async deleteMaterial(
    materialId: string
  ): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/api/v1/materials/${materialId}`);
  }

  // --- Problems ---
  async listProblems(
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/problems", { params });
  }

  async getProblem(
    problemId: string,
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/problems/${problemId}`, { params });
  }

  async createProblem(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/problems", { json: data });
  }

  async updateProblem(
    problemId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/problems/${problemId}`, { json: data });
  }

  async duplicateProblem(
    problemId: string
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/api/v1/problems/${problemId}/duplicate`);
  }

  // --- Activities ---
  async createActivity(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activities", { json: data });
  }

  async getActivity(
    activityId: string,
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/activities/${activityId}`, { params });
  }

  async updateActivity(
    activityId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/activities/${activityId}`, {
      json: data,
    });
  }

  async deleteActivity(
    activityId: string
  ): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/api/v1/activities/${activityId}`);
  }

  async duplicateActivity(
    activityId: string
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/api/v1/activities/${activityId}/duplicate`);
  }

  async doManyActivities(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activities/do_many", { json: data });
  }

  // --- Material Bundles ---
  async listMaterialBundles(
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/material_bundles", { params });
  }

  async getMaterialBundle(
    bundleId: string,
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/material_bundles/${bundleId}`, {
      params,
    });
  }

  async createMaterialBundle(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/material_bundles", { json: data });
  }

  async updateMaterialBundle(
    bundleId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/material_bundles/${bundleId}`, {
      json: data,
    });
  }

  async deleteMaterialBundle(
    bundleId: string
  ): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/api/v1/material_bundles/${bundleId}`);
  }

  async duplicateMaterialBundle(
    bundleId: string
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/api/v1/material_bundles/${bundleId}/duplicate`
    );
  }

  // --- Activity Transitions ---
  async createActivityTransition(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activity_transitions", { json: data });
  }

  async deleteActivityTransition(
    transitionId: string
  ): Promise<Record<string, unknown>> {
    return this.request(
      "DELETE",
      `/api/v1/activity_transitions/${transitionId}`
    );
  }

  async doManyActivityTransitions(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activity_transitions/do_many", {
      json: data,
    });
  }

  // --- Tags ---
  async listTags(
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/tags", { params });
  }

  // --- Problem Collections ---
  async listProblemCollections(
    params?: Record<string, string | number | boolean>
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/problem_collections", { params });
  }

  async doManyProblemCollectionsProblems(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/problem_collections_problems/do_many", {
      json: data,
    });
  }

  // --- Quiz Activities ---
  async createQuizActivity(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/quiz_activities", { json: data });
  }

  async updateQuizActivity(
    activityId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/quiz_activities/${activityId}`, {
      json: data,
    });
  }
}

export const client = new CodleClient();
