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
    `태그(Tag) 목록을 조회합니다.

태그는 자료, 문제, 시리즈에 연결하여 분류/검색에 활용합니다.
자료나 문제에 태그를 연결하려면 해당 리소스의 create/update 시 tag_ids를 사용하세요.

사용 가능한 태그 도메인:
- problem: 문제용 태그
- material: 자료용 태그
- difficulty: 난이도 태그
- school_level: 학교 수준 태그
- category: 카테고리 태그
- material_bundle_topic: 시리즈 주제 태그
- material_bundle_category: 시리즈 카테고리 태그`,
    {
      domain: z
        .string()
        .optional()
        .describe("태그 도메인 필터 (위 목록 참조)"),
      query: z.string().optional().describe("태그 이름 검색 키워드"),
      page_size: z
        .number()
        .default(50)
        .describe("페이지당 결과 수 (기본 50, 최대 100)"),
      page_number: z
        .number()
        .default(1)
        .describe("페이지 번호 (1부터 시작)"),
    },
    async ({ domain, query, page_size, page_number }) => {
      const params: Record<string, string | number> = {
        "page[size]": Math.min(page_size, 100),
        "page[number]": page_number,
      };
      if (domain && VALID_DOMAINS.includes(domain)) {
        params["filter[domain]"] = domain;
      }

      const response = await client.listTags(params);
      let tags = extractList(response);

      if (query) {
        const q = query.toLowerCase();
        tags = tags.filter((t) =>
          String(t.name || "")
            .toLowerCase()
            .includes(q)
        );
      }

      if (!tags.length) {
        return { content: [{ type: "text", text: "태그가 없습니다." }] };
      }

      const lines = [`태그 목록 (${tags.length}건):`];
      for (const t of tags) {
        const tagDomain = t.domain ?? "unknown";
        lines.push(
          `  [${t.id}] ${t.name ?? "(무제)"} (domain: ${tagDomain})`
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
