import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import {
  createActivity,
  updateActivity,
  deleteActivity,
  duplicateActivity,
  setActivityFlow,
  setActivityBranch,
  pascalToSnake,
} from "../services/activity.service.js";

export { pascalToSnake };

export function registerActivityTools(server: McpServer): void {
  server.tool(
    "manage_activities",
    "활동(Activity) CRUD. 유형별 속성(url, content 등)은 update_activitiable 사용.",
    {
      action: z
        .enum(["create", "update", "delete", "duplicate"])
        .describe("수행할 작업"),
      material_id: z.string().optional().describe("자료 ID (create 시 필수)"),
      activity_id: z
        .string()
        .optional()
        .describe("활동 ID (update, delete, duplicate 시 필수)"),
      name: z
        .string()
        .optional()
        .describe("활동 이름 (create 시 필수, 최대 64자)"),
      activity_type: z
        .string()
        .optional()
        .describe(
          "활동 유형 (create 시 필수). Html, Quiz, Board, Sheet, Video, Embedded 등",
        ),
      depth: z
        .number()
        .optional()
        .describe(
          "활동 깊이, 1-indexed (1=메인, 2=하위, 3=하위의 하위). create 시 미지정이면 1",
        ),
      tag_ids: z.array(z.string()).optional().describe("연결할 태그 ID 목록"),
      entry_category: z
        .enum(["project", "stage"])
        .optional()
        .describe(
          "엔트리 활동 카테고리 (activity_type이 EntryActivity일 때 필수)",
        ),
    },
    async ({
      action,
      material_id,
      activity_id,
      name,
      activity_type,
      depth,
      tag_ids,
      entry_category,
    }) => {
      if (action === "create") {
        if (!material_id || !name || !activity_type) {
          return {
            content: [
              {
                type: "text",
                text: "create 시 material_id, name, activity_type은 필수입니다.",
              },
            ],
          };
        }
        try {
          const result = await createActivity(client, {
            material_id,
            name,
            activity_type,
            depth,
            tag_ids,
            entry_category,
          });
          return { content: [{ type: "text", text: result.text }] };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [{ type: "text", text: `활동 생성 실패: ${e.detail}` }],
            };
          }
          if (e instanceof Error) {
            return { content: [{ type: "text", text: e.message }] };
          }
          throw e;
        }
      }

      if (action === "update") {
        if (!activity_id) {
          return {
            content: [
              { type: "text", text: "update 시 activity_id는 필수입니다." },
            ],
          };
        }
        const result = await updateActivity(client, {
          activity_id,
          name,
          depth,
          tag_ids,
        });
        return { content: [{ type: "text", text: result.text }] };
      }

      if (action === "delete") {
        if (!activity_id) {
          return {
            content: [
              { type: "text", text: "delete 시 activity_id는 필수입니다." },
            ],
          };
        }
        try {
          const result = await deleteActivity(client, activity_id);
          return { content: [{ type: "text", text: result.text }] };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [{ type: "text", text: `활동 삭제 실패: ${e.detail}` }],
            };
          }
          throw e;
        }
      }

      if (action === "duplicate") {
        if (!activity_id) {
          return {
            content: [
              { type: "text", text: "duplicate 시 activity_id는 필수입니다." },
            ],
          };
        }
        const result = await duplicateActivity(client, activity_id);
        return { content: [{ type: "text", text: result.text }] };
      }

      return {
        content: [
          {
            type: "text",
            text: `유효하지 않은 action: ${action}. create, update, delete, duplicate 중 하나를 사용하세요.`,
          },
        ],
      };
    },
  );

  server.tool(
    "set_activity_flow",
    "코스 흐름(선형 연결)을 설정합니다. 기존 선형 transition을 교체하며 갈림길은 유지.",
    {
      material_id: z.string().describe("자료 ID"),
      activity_ids: z
        .array(z.string())
        .min(2)
        .describe('활동 ID 배열 (코스 흐름 순서). 예: ["123", "41", "151"]'),
    },
    async ({ material_id, activity_ids }) => {
      try {
        const result = await setActivityFlow(client, {
          material_id,
          activity_ids,
        });
        return { content: [{ type: "text", text: result.text }] };
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              { type: "text", text: `코스 흐름 설정 실패: ${e.detail}` },
            ],
          };
        }
        throw e;
      }
    },
  );

  server.tool(
    "set_activity_branch",
    "갈림길 transition을 일괄 설정. branch_from의 기존 transition(선형 포함)을 교체. mid 필수, low/high 선택 (최소 2개).",
    {
      material_id: z.string().describe("자료 ID"),
      branch_from: z
        .string()
        .describe("분기점 활동 ID (이 활동에서 갈림길이 시작됨)"),
      mid_activity_id: z.string().describe("기본 갈림길 활동 ID (필수)"),
      low_activity_id: z.string().optional().describe("보완 갈림길 활동 ID"),
      high_activity_id: z.string().optional().describe("정복 갈림길 활동 ID"),
    },
    async ({
      material_id,
      branch_from,
      mid_activity_id,
      low_activity_id,
      high_activity_id,
    }) => {
      try {
        const result = await setActivityBranch(client, {
          material_id,
          branch_from,
          mid_activity_id,
          low_activity_id,
          high_activity_id,
        });
        return { content: [{ type: "text", text: result.text }] };
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              { type: "text", text: `갈림길 설정 실패: ${e.detail}` },
            ],
          };
        }
        if (e instanceof Error) {
          return { content: [{ type: "text", text: e.message }] };
        }
        throw e;
      }
    },
  );
}
