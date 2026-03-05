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

export function registerContentTools(server: McpServer): void {
  server.tool(
    "update_board",
    "BoardActivity의 안내문을 markdown으로 설정.",
    {
      activity_id: z.string().describe("활동 ID"),
      content: z.string().describe("markdown 문자열"),
      name: z.string().optional().describe("보드 이름 (선택)"),
    },
    async ({ activity_id, content, name }) => {
      // activity_id → board_id 조회
      let boardId: string;
      try {
        const boardsResp = await client.listBoards({
          "filter[activity_id]": activity_id,
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
              {
                type: "text" as const,
                text: `Board 조회 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const lexical = convertFromMarkdown(content);

      const attrs: Record<string, unknown> = { lexical };
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
    },
  );

  server.tool(
    "update_sheet_description",
    "활동지의 지시문/설명을 markdown으로 설정.",
    {
      activity_id: z.string().describe("활동 ID"),
      content: z.string().describe("markdown 문자열"),
    },
    async ({ activity_id, content }) => {
      // activity_id에서 activitiable_id(SheetActivity ID) 가져오기
      // AIDEV-NOTE: SheetActivity의 실제 ID는 Activity의 activitiable_id다.
      // material detail의 included에서 추출하는 대신 activities API로 직접 조회.
      let sheetActivityId: string;
      try {
        const actResp = await client.request(
          "GET",
          `/api/v1/activities/${activity_id}`,
          {
            params: { include: "activitiable" },
          },
        );
        const actData = (actResp.data as Record<string, unknown>) || {};
        const relationships =
          (actData.relationships as Record<string, unknown>) || {};
        const activitiable =
          (relationships.activitiable as Record<string, unknown>) || {};
        const rel = (activitiable.data as Record<string, unknown>) || {};
        sheetActivityId = String(rel.id || "");

        if (!sheetActivityId) {
          return {
            content: [
              {
                type: "text" as const,
                text: `활동 ${activity_id}에서 SheetActivity ID를 찾을 수 없습니다.`,
              },
            ],
          };
        }
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
        throw e;
      }

      const lexical = convertFromMarkdown(content);

      const payload = buildJsonApiPayload(
        "sheet_activities",
        { description: lexical },
        sheetActivityId,
      );
      try {
        const response = await client.updateSheetActivity(
          sheetActivityId,
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
    },
  );
}
