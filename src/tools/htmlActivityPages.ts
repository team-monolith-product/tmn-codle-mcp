import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import { manageHtmlActivityPages } from "../services/htmlActivityPage.service.js";

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
      try {
        const result = await manageHtmlActivityPages(client, {
          activity_id,
          pages,
        });
        return { content: [{ type: "text" as const, text: result.text }] };
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
        if (e instanceof Error) {
          return { content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    },
  );
}
