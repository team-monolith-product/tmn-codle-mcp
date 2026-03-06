import { config } from "../config.js";
import { getAccessToken } from "../context.js";
import { logger } from "../logger.js";
import { CodleAPIError, extractErrorDetail } from "./errors.js";

export class CodleClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  private getToken(): string | undefined {
    return getAccessToken();
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  async ensureAuth(): Promise<void> {
    if (!this.getToken()) {
      throw new CodleAPIError(
        401,
        "Authorization 헤더에 Bearer 토큰이 필요합니다.",
      );
    }
  }

  static extractErrorDetailStatic(
    statusCode: number,
    contentType: string,
    text: string,
  ): string {
    return extractErrorDetail(statusCode, contentType, text);
  }

  private logRequest(
    method: string,
    path: string,
    params?: Record<string, string | number>,
    body?: unknown,
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
    },
  ): Promise<Record<string, unknown>> {
    await this.ensureAuth();

    const { params, json } = options ?? {};
    this.logRequest(
      method,
      path,
      params as Record<string, string | number>,
      json,
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

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const detail = extractErrorDetail(response.status, contentType, text);
      logger.warn(
        "%s %s → %d: %s",
        method,
        path,
        response.status,
        detail.slice(0, 300),
      );
      throw new CodleAPIError(response.status, detail);
    }

    logger.debug("%s %s → %d", method, path, response.status);
    if (response.status === 204) return {};
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0") return {};
    // AIDEV-NOTE: CrudActions#destroy가 head(:ok)로 빈 body를 반환. content-length 헤더 없을 수 있음.
    const text = await response.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  }

  // --- Me ---
  async getMe(): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/me");
  }

  // --- Materials ---
  async listMaterials(
    params?: Record<string, string | number | boolean>,
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/materials", { params });
  }

  async getMaterial(
    materialId: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Record<string, unknown>> {
    return this.request("GET", `/api/v1/materials/${materialId}`, { params });
  }

  async createMaterial(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/materials", { json: data });
  }

  async updateMaterial(
    materialId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/materials/${materialId}`, {
      json: data,
    });
  }

  async duplicateMaterial(
    materialId: string,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/api/v1/materials/${materialId}/duplicate`);
  }

  // --- Activities ---
  async createActivity(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activities", { json: data });
  }

  async updateActivity(
    activityId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/activities/${activityId}`, {
      json: data,
    });
  }

  async deleteActivity(activityId: string): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/api/v1/activities/${activityId}`);
  }

  async duplicateActivity(
    activityId: string,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/api/v1/activities/${activityId}/duplicate`);
  }

  // --- Activity Transitions ---
  async createActivityTransition(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activity_transitions", { json: data });
  }

  async doManyActivityTransitions(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/activity_transitions/do_many", {
      json: data,
    });
  }

  // --- Tags ---
  async listTags(
    params?: Record<string, string | number | boolean>,
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/tags", { params });
  }
}

export const client = new CodleClient();
