import { CodleClient } from "../api/client.js";
import { extractIncluded } from "../api/models.js";

interface ExistingPage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  position: number;
  progress_calculation_method: string;
  completion_seconds: number | null;
}

export interface ManageHtmlActivityPagesParams {
  activity_id: string;
  pages: Array<{
    url: string;
    width?: number;
    height?: number;
    progress_calculation_method?: "time" | "no_calculation";
    completion_seconds?: number;
  }>;
}

async function resolveHtmlActivityId(
  client: CodleClient,
  activityId: string,
): Promise<string> {
  const resp = await client.request("GET", `/api/v1/activities/${activityId}`, {
    params: { include: "activitiable" },
  });
  const actData = (resp.data as Record<string, unknown>) || {};
  const relationships =
    (actData.relationships as Record<string, unknown>) || {};
  const activitiable =
    (relationships.activitiable as Record<string, unknown>) || {};
  const rel = (activitiable.data as Record<string, unknown>) || {};

  const id = String(rel.id || "");
  const rawType = String(rel.type || "");

  if (!id || !rawType) {
    throw new Error(`활동 ${activityId}에서 activitiable을 찾을 수 없습니다.`);
  }

  // snake_case → PascalCase
  const type = rawType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  if (type !== "HtmlActivity") {
    throw new Error(
      `활동 ${activityId}의 유형이 ${type}입니다. HtmlActivity만 지원합니다.`,
    );
  }

  return id;
}

async function getExistingPages(
  client: CodleClient,
  htmlActivityId: string,
): Promise<ExistingPage[]> {
  const resp = await client.request(
    "GET",
    `/api/v1/html_activities/${htmlActivityId}`,
    { params: { include: "html_activity_pages" } },
  );

  const pages = extractIncluded(
    resp as {
      included?: Array<{
        type?: string;
        id?: string;
        attributes?: Record<string, unknown>;
      }>;
    },
    "html_activity_page",
  );

  return pages
    .map((p) => ({
      id: String(p.id),
      url: String(p.url || ""),
      width: p.width != null ? Number(p.width) : null,
      height: p.height != null ? Number(p.height) : null,
      position: Number(p.position ?? 0),
      progress_calculation_method: String(
        p.progress_calculation_method || "no_calculation",
      ),
      completion_seconds:
        p.completion_seconds != null ? Number(p.completion_seconds) : null,
    }))
    .sort((a, b) => a.position - b.position);
}

export async function manageHtmlActivityPages(
  client: CodleClient,
  params: ManageHtmlActivityPagesParams,
): Promise<{ text: string }> {
  const htmlActivityId = await resolveHtmlActivityId(
    client,
    params.activity_id,
  );
  const existingPages = await getExistingPages(client, htmlActivityId);

  const dataToCreate: Array<Record<string, unknown>> = [];
  const dataToUpdate: Array<Record<string, unknown>> = [];
  const dataToDestroy: Array<Record<string, unknown>> = [];

  for (let i = 0; i < params.pages.length; i++) {
    const desired = params.pages[i];
    const desiredMethod = desired.progress_calculation_method ?? "time";
    const desiredSeconds =
      desired.completion_seconds ?? (desiredMethod === "time" ? 3 : null);

    if (i < existingPages.length) {
      const existing = existingPages[i];
      const attrs: Record<string, unknown> = {};

      if (existing.url !== desired.url) attrs.url = desired.url;
      if (existing.position !== i) attrs.position = i;
      if (desired.width !== undefined && existing.width !== desired.width)
        attrs.width = desired.width;
      if (desired.height !== undefined && existing.height !== desired.height)
        attrs.height = desired.height;
      if (existing.progress_calculation_method !== desiredMethod)
        attrs.progress_calculation_method = desiredMethod;
      if (existing.completion_seconds !== desiredSeconds)
        attrs.completion_seconds = desiredSeconds;

      if (Object.keys(attrs).length) {
        dataToUpdate.push({ id: existing.id, attributes: attrs });
      }
    } else {
      const attrs: Record<string, unknown> = {
        html_activity_id: htmlActivityId,
        url: desired.url,
        position: i,
        progress_calculation_method: desiredMethod,
        completion_seconds: desiredSeconds,
      };
      if (desired.width !== undefined) attrs.width = desired.width;
      if (desired.height !== undefined) attrs.height = desired.height;

      dataToCreate.push({ attributes: attrs });
    }
  }

  for (let i = params.pages.length; i < existingPages.length; i++) {
    dataToDestroy.push({ id: existingPages[i].id });
  }

  if (!dataToCreate.length && !dataToUpdate.length && !dataToDestroy.length) {
    return { text: "변경 사항 없음." };
  }

  await client.request("POST", "/api/v1/html_activity_pages/do_many", {
    json: {
      data_to_create: dataToCreate,
      data_to_update: dataToUpdate,
      data_to_destroy: dataToDestroy,
    },
  });

  const parts: string[] = [];
  if (dataToCreate.length) parts.push(`추가 ${dataToCreate.length}`);
  if (dataToUpdate.length) parts.push(`변경 ${dataToUpdate.length}`);
  if (dataToDestroy.length) parts.push(`제거 ${dataToDestroy.length}`);
  return {
    text: `교안 페이지 설정 완료 (${parts.join(", ")}). 최종 페이지 수: ${params.pages.length}`,
  };
}
