import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import { updateActivitiable } from "../services/activitiable.service.js";

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
      try {
        const result = await updateActivitiable(client, {
          activity_id,
          content,
          name,
          url,
          goals,
        });
        return { content: [{ type: "text" as const, text: result.text }] };
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `업데이트 실패: ${e.detail}`,
              },
            ],
          };
        }
        if (e instanceof Error) {
          return { content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    },
  );
}
