import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
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

async function resolveHtmlActivityId(activityId: string): Promise<string> {
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

export function registerHtmlActivityPageTools(server: McpServer): void {
  server.tool(
    "manage_html_activity_pages",
    "교안(HtmlActivity)의 페이지 목록을 선언적으로 설정. pages 배열이 최종 상태이며, 순서가 position.",
    {
      activity_id: z.string().describe("교안 활동 ID"),
      pages: z
        .array(
          z.object({
            url: z.string().describe("페이지 URL"),
            width: z.number().optional().describe("너비 (px)"),
            height: z.number().optional().describe("높이 (px)"),
            progress_calculation_method: z
              .enum(["time", "no_calculation"])
              .default("time")
              .describe("진행도 계산 방식"),
            completion_seconds: z
              .number()
              .optional()
              .describe(
                "진행도 계산 시간 (초). progress_calculation_method가 time일 때 사용",
              ),
          }),
        )
        .describe("최종 페이지 목록 (순서대로). 빈 배열이면 전체 제거."),
    },
    async ({ activity_id, pages }) => {
      let htmlActivityId: string;
      try {
        htmlActivityId = await resolveHtmlActivityId(activity_id);
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Activity 조회 실패: ${e.detail}`,
              },
            ],
          };
        }
        if (e instanceof Error) {
          return {
            content: [{ type: "text" as const, text: e.message }],
          };
        }
        throw e;
      }

      let existingPages: ExistingPage[];
      try {
        existingPages = await getExistingPages(htmlActivityId);
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `교안 페이지 조회 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const dataToCreate: Array<Record<string, unknown>> = [];
      const dataToUpdate: Array<Record<string, unknown>> = [];
      const dataToDestroy: Array<Record<string, unknown>> = [];

      // Match desired pages to existing pages by array order
      for (let i = 0; i < pages.length; i++) {
        const desired = pages[i];
        const desiredMethod = desired.progress_calculation_method ?? "time";
        const desiredSeconds =
          desired.completion_seconds ?? (desiredMethod === "time" ? 3 : null);

        if (i < existingPages.length) {
          // Update existing page if any attribute differs
          const existing = existingPages[i];
          const attrs: Record<string, unknown> = {};

          if (existing.url !== desired.url) attrs.url = desired.url;
          if (existing.position !== i) attrs.position = i;
          if (desired.width !== undefined && existing.width !== desired.width)
            attrs.width = desired.width;
          if (
            desired.height !== undefined &&
            existing.height !== desired.height
          )
            attrs.height = desired.height;
          if (existing.progress_calculation_method !== desiredMethod)
            attrs.progress_calculation_method = desiredMethod;
          if (existing.completion_seconds !== desiredSeconds)
            attrs.completion_seconds = desiredSeconds;

          if (Object.keys(attrs).length) {
            dataToUpdate.push({ id: existing.id, attributes: attrs });
          }
        } else {
          // Create new page
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

      // Destroy excess existing pages
      for (let i = pages.length; i < existingPages.length; i++) {
        dataToDestroy.push({ id: existingPages[i].id });
      }

      if (
        !dataToCreate.length &&
        !dataToUpdate.length &&
        !dataToDestroy.length
      ) {
        return {
          content: [{ type: "text" as const, text: "변경 사항 없음." }],
        };
      }

      try {
        await client.request("POST", "/api/v1/html_activity_pages/do_many", {
          json: {
            data_to_create: dataToCreate,
            data_to_update: dataToUpdate,
            data_to_destroy: dataToDestroy,
          },
        });
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `교안 페이지 설정 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const parts: string[] = [];
      if (dataToCreate.length) parts.push(`추가 ${dataToCreate.length}`);
      if (dataToUpdate.length) parts.push(`변경 ${dataToUpdate.length}`);
      if (dataToDestroy.length) parts.push(`제거 ${dataToDestroy.length}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `교안 페이지 설정 완료 (${parts.join(
              ", ",
            )}). 최종 페이지 수: ${pages.length}`,
          },
        ],
      };
    },
  );
}
