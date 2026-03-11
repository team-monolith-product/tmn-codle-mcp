import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
} from "../api/models.js";
import { convertFromMarkdown } from "../lexical/index.js";

interface ActivitiableInfo {
  type: string;
  id: string;
}

async function resolveActivitiable(
  activityId: string,
): Promise<ActivitiableInfo> {
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

  return { type, id };
}

export function registerActivitiableTools(server: McpServer): void {
  server.tool(
    "update_activitiable",
    "활동의 activitiable 속성을 업데이트. Board(content,name), Sheet(content→description), Embedded(url,goals), Video(url) 지원. type은 자동 감지.",
    {
      activity_id: z.string().describe("활동 ID"),
      content: z
        .string()
        .optional()
        .describe(
          "Board 안내문 또는 Sheet 지시문 (markdown). Board/Sheet에만 적용",
        ),
      name: z.string().optional().describe("Board 이름. Board에만 적용"),
      url: z
        .string()
        .optional()
        .describe("외부 URL. Embedded/VideoActivity에 적용"),
      goals: z
        .array(z.string())
        .optional()
        .describe(
          "학습목표 배열 (각 항목 markdown). EmbeddedActivity에만 적용",
        ),
    },
    async ({ activity_id, content, name, url, goals }) => {
      let info: ActivitiableInfo;
      try {
        info = await resolveActivitiable(activity_id);
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

      if (info.type === "BoardActivity") {
        if (content === undefined && name === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "BoardActivity: content 또는 name 중 하나 이상 필요합니다.",
              },
            ],
          };
        }

        // Board는 폴리모픽 boardable로 조회
        let boardId: string;
        try {
          const boardsResp = await client.listBoards({
            "filter[boardable_type]": "Activity",
            "filter[boardable_id]": activity_id,
          });
          const boards = extractList(boardsResp);
          if (!boards.length) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `활동 ${activity_id}에 연결된 Board가 없습니다.`,
                },
              ],
            };
          }
          boardId = String(boards[0].id);
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                { type: "text" as const, text: `Board 조회 실패: ${e.detail}` },
              ],
            };
          }
          throw e;
        }

        const attrs: Record<string, unknown> = {};
        if (content !== undefined) attrs.lexical = convertFromMarkdown(content);
        if (name !== undefined) attrs.name = name;

        const payload = buildJsonApiPayload("boards", attrs, boardId);
        try {
          const response = await client.updateBoard(
            boardId,
            payload as Record<string, unknown>,
          );
          const board = extractSingle(response);
          return {
            content: [
              {
                type: "text" as const,
                text: `보드 업데이트 완료: [${board.id}] (activity=${activity_id})`,
              },
            ],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `보드 업데이트 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
      }

      if (info.type === "SheetActivity") {
        if (content === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "SheetActivity: content는 필수입니다.",
              },
            ],
          };
        }

        const lexical = convertFromMarkdown(content);
        const payload = buildJsonApiPayload(
          "sheet_activities",
          { description: lexical },
          info.id,
        );
        try {
          const response = await client.updateSheetActivity(
            info.id,
            payload as Record<string, unknown>,
          );
          const sheet = extractSingle(response);
          return {
            content: [
              {
                type: "text" as const,
                text: `활동지 설명 업데이트 완료: [${sheet.id}] (activity=${activity_id})`,
              },
            ],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `활동지 설명 업데이트 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
      }

      if (info.type === "EmbeddedActivity") {
        if (url === undefined && goals === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "EmbeddedActivity: url 또는 goals 중 하나 이상 필요합니다.",
              },
            ],
          };
        }

        const attrs: Record<string, unknown> = {};
        if (url !== undefined) attrs.url = url;
        if (goals !== undefined) {
          attrs.goals = goals.map((g) => convertFromMarkdown(g));
        }

        const payload = buildJsonApiPayload(
          "embedded_activities",
          attrs,
          info.id,
        );
        try {
          const response = await client.updateEmbeddedActivity(
            info.id,
            payload as Record<string, unknown>,
          );
          const embedded = extractSingle(response);
          return {
            content: [
              {
                type: "text" as const,
                text: `EmbeddedActivity 업데이트 완료: [${embedded.id}] (activity=${activity_id})`,
              },
            ],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `EmbeddedActivity 업데이트 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
      }

      if (info.type === "VideoActivity") {
        if (url === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "VideoActivity: url은 필수입니다.",
              },
            ],
          };
        }

        const payload = buildJsonApiPayload(
          "video_activities",
          { url },
          info.id,
        );
        try {
          await client.request("PUT", `/api/v1/video_activities/${info.id}`, {
            json: payload,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `VideoActivity 업데이트 완료: [${info.id}] (activity=${activity_id})`,
              },
            ],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `VideoActivity 업데이트 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${info.type}은 update_activitiable에서 지원하지 않는 유형입니다.`,
          },
        ],
      };
    },
  );
}
