import { config } from "../config.js";
import { logger } from "../logger.js";
import { CodleAPIError, extractErrorDetail } from "./errors.js";

export interface DirectUploadResponse {
  signed_id: string;
  filename: string;
  direct_upload: {
    url: string;
    headers: Record<string, string>;
  };
}

export class CodleClient {
  private baseUrl: string;
  private accessToken: string;
  private onUnauthorized?: () => Promise<string>;

  constructor(
    accessToken: string,
    apiUrl?: string,
    onUnauthorized?: () => Promise<string>,
  ) {
    this.accessToken = accessToken;
    this.baseUrl = apiUrl ?? config.apiUrl;
    this.onUnauthorized = onUnauthorized;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private getToken(): string {
    return this.accessToken;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.getToken()}` };
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
    return this.requestInternal(method, path, options, false);
  }

  private async requestInternal(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number | boolean>;
      json?: unknown;
    },
    isRetry?: boolean,
  ): Promise<Record<string, unknown>> {
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
      // AIDEV-NOTE: 401 시 onUnauthorized 콜백으로 토큰 갱신 후 1회 재시도.
      // BaseCommand가 credential 로드 시 콜백을 주입한다.
      if (response.status === 401 && this.onUnauthorized && !isRetry) {
        logger.debug("401 수신, 토큰 갱신 시도...");
        const newToken = await this.onUnauthorized();
        this.accessToken = newToken;
        return this.requestInternal(method, path, options, true);
      }

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

  // --- Direct Uploads (ActiveStorage) ---
  // AIDEV-NOTE: ActiveStorage::DirectUploadsController는 vnd.api+json이 아닌 일반 application/json을
  // 기대하며 JSON:API 엔벨로프도 쓰지 않는다. request() 헬퍼와 계약이 달라서 생 fetch를 사용한다.
  async createDirectUpload(blob: {
    filename: string;
    content_type: string;
    byte_size: number;
    checksum: string;
  }): Promise<DirectUploadResponse> {
    return this.createDirectUploadInternal(blob, false);
  }

  private async createDirectUploadInternal(
    blob: {
      filename: string;
      content_type: string;
      byte_size: number;
      checksum: string;
    },
    isRetry: boolean,
  ): Promise<DirectUploadResponse> {
    const url = `${this.baseUrl}/api/v1/direct_uploads`;
    logger.debug(
      "POST /api/v1/direct_uploads filename=%s size=%d",
      blob.filename,
      blob.byte_size,
    );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ blob }),
    });

    if (!response.ok) {
      if (response.status === 401 && this.onUnauthorized && !isRetry) {
        logger.debug("direct_uploads 401 수신, 토큰 갱신 시도...");
        const newToken = await this.onUnauthorized();
        this.accessToken = newToken;
        return this.createDirectUploadInternal(blob, true);
      }
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const detail = extractErrorDetail(response.status, contentType, text);
      throw new CodleAPIError(response.status, detail);
    }

    const data = (await response.json()) as DirectUploadResponse;
    return data;
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

  // --- Problems ---
  async createProblem(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/problems", { json: data });
  }

  async updateProblem(
    problemId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/problems/${problemId}`, { json: data });
  }

  async deleteProblem(problemId: string): Promise<Record<string, unknown>> {
    return this.request("DELETE", `/api/v1/problems/${problemId}`);
  }

  // --- Problem Collections Problems ---
  async doManyPCP(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      "/api/v1/problem_collections_problems/do_many",
      { json: data },
    );
  }

  // --- Problem Answers ---
  async doManyProblemAnswers(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/problem_answers/do_many", {
      json: data,
    });
  }

  // --- Descriptive Criteria ---
  async doManyDescriptiveCriteria(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/api/v1/descriptive_criteria/do_many", {
      json: data,
    });
  }

  // --- Boards ---
  async listBoards(
    params?: Record<string, string | number | boolean>,
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/api/v1/boards", { params });
  }

  async updateBoard(
    boardId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/boards/${boardId}`, { json: data });
  }

  // --- Embedded Activities ---
  async updateEmbeddedActivity(
    embeddedActivityId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(
      "PUT",
      `/api/v1/embedded_activities/${embeddedActivityId}`,
      { json: data },
    );
  }

  // --- Sheet Activities ---
  async updateSheetActivity(
    sheetActivityId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/api/v1/sheet_activities/${sheetActivityId}`, {
      json: data,
    });
  }
}
