import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../api/client.js";
import { searchTags } from "../services/tag.service.js";

export function registerTagTools(server: McpServer): void {
  server.tool(
    "manage_tags",
    "태그(Tag) 검색. domain과 키워드로 필터링 가능.",
    {
      domain: z
        .string()
        .optional()
        .describe(
          "태그 도메인 (material, problem, difficulty, school_level, category 등)",
        ),
      query: z.string().optional().describe("태그 이름 검색 키워드"),
      page_size: z
        .number()
        .default(50)
        .describe("페이지당 결과 수 (기본 50, 최대 100)"),
      page_number: z.number().default(1).describe("페이지 번호 (1부터 시작)"),
    },
    async ({ domain, query, page_size, page_number }) => {
      const result = await searchTags(client, {
        domain,
        query,
        page_size,
        page_number,
      });
      return { content: [{ type: "text", text: result.text }] };
    },
  );
}
