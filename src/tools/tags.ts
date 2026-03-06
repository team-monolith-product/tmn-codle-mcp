import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../api/client.js";
import { extractList } from "../api/models.js";

const VALID_DOMAINS = [
  "problem",
  "material",
  "standard_concept",
  "difficulty",
  "school_level",
  "metadata",
  "major_chapter",
  "category",
  "material_bundle_topic",
  "material_bundle_category",
  "material_bundle_language",
];

export function registerTagTools(server: McpServer): void {
  server.tool(
    "manage_tags",
    "태그(Tag) 목록을 조회합니다.",
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
    // AIDEV-NOTE: Tags API는 인증 불필요(before_action 없음)하지만,
    // MCP 서버는 항상 인증된 사용자가 사용하므로 ensureAuth()를 우회하지 않는다.
    async ({ domain, query, page_size, page_number }) => {
      const params: Record<string, string | number> = {
        "page[size]": Math.min(page_size, 100),
        "page[number]": page_number,
      };
      if (domain && VALID_DOMAINS.includes(domain)) {
        params["filter[domain]"] = domain;
      }
      if (query) {
        params["filter[name_cont]"] = query;
      }

      const response = await client.listTags(params);
      const tags = extractList(response);

      if (!tags.length) {
        return { content: [{ type: "text", text: "태그가 없습니다." }] };
      }

      const lines = [`태그 목록 (${tags.length}건):`];
      for (const t of tags) {
        const tagDomain = t.domain ?? "unknown";
        lines.push(`  [${t.id}] ${t.name ?? "(무제)"} (domain: ${tagDomain})`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
