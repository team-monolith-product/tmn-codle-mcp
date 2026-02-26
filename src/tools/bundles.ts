import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
  formatBundleSummary,
  formatMaterialSummary,
} from "../api/models.js";

export function registerBundleTools(server: McpServer): void {
  server.tool(
    "list_bundles",
    `시리즈(MaterialBundle) 목록을 조회합니다.

시리즈는 여러 자료를 차시 순서로 묶은 커리큘럼입니다.`,
    {
      query: z
        .string()
        .optional()
        .describe("검색 키워드 (시리즈 제목에서 검색, 공백 무시)"),
      is_published: z
        .boolean()
        .optional()
        .describe(
          "게시 여부 필터 (True=게시된 시리즈만, False=미게시만, None=전체)"
        ),
      is_official: z
        .boolean()
        .optional()
        .describe("공식 시리즈 여부 필터"),
      tag_ids: z
        .array(z.string())
        .optional()
        .describe("필터링할 태그 ID 목록 (material_bundle_category 도메인 태그)"),
      page_size: z
        .number()
        .default(20)
        .describe("페이지당 결과 수 (기본 20, 최대 100)"),
      page_number: z
        .number()
        .default(1)
        .describe("페이지 번호 (1부터 시작)"),
    },
    async ({ query, is_published, is_official, tag_ids, page_size, page_number }) => {
      await client.ensureAuth();
      const params: Record<string, string | number> = {
        "page[size]": Math.min(page_size, 100),
        "page[number]": page_number,
      };
      if (query) {
        params["filter[compact_title]"] = query.replace(/ /g, "");
      }
      if (is_official !== undefined) {
        params["filter[is_official_eq]"] = String(is_official);
      }
      if (tag_ids?.length) {
        params["filter[material_bundle_category_tag_ids]"] = tag_ids.join(",");
      }

      const effectivePublished = is_published ?? false;
      params["filter[is_published_eq]"] = String(effectivePublished);

      if (!effectivePublished) {
        if (!client.userId) {
          return {
            content: [
              {
                type: "text",
                text: "인증된 user_id가 없어 시리즈를 조회할 수 없습니다. 인증 설정을 확인하세요.",
              },
            ],
          };
        }
        params["filter[user_id_eq]"] = client.userId;
      }

      let response: Record<string, unknown>;
      try {
        response = await client.listMaterialBundles(params);
      } catch (e) {
        if (e instanceof CodleAPIError && (e.statusCode === 400 || e.statusCode === 403)) {
          return {
            content: [
              {
                type: "text",
                text:
                  `시리즈 조회 실패 (${e.statusCode}): ${e.detail}\n` +
                  "유효한 필터 조합:\n" +
                  "  1. is_published=true (단독, user_id 불가)\n" +
                  "  2. is_published=false + user_id (자동 설정됨)\n" +
                  `전송된 파라미터: ${JSON.stringify(params)}`,
              },
            ],
          };
        }
        throw e;
      }

      const bundles = extractList(response);

      if (!bundles.length) {
        return {
          content: [{ type: "text", text: "시리즈가 없습니다." }],
        };
      }

      const lines = [`시리즈 목록 (${bundles.length}건):`];
      for (const b of bundles) {
        lines.push(formatBundleSummary(b));
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "get_bundle_detail",
    `시리즈(MaterialBundle)의 상세 정보를 조회합니다.

시리즈에 포함된 자료 목록과 순서를 확인할 수 있습니다.`,
    {
      bundle_id: z.string().describe("조회할 시리즈의 ID"),
    },
    async ({ bundle_id }) => {
      const params = { include: "materials,tags" };
      const response = await client.getMaterialBundle(bundle_id, params);
      const bundle = extractSingle(response);

      const included = (
        (response as Record<string, unknown>).included as Array<
          Record<string, unknown>
        >
      ) || [];

      const materials = included
        .filter((i) => i.type === "material")
        .map((i): Record<string, unknown> => ({
          id: i.id,
          ...((i.attributes as Record<string, unknown>) || {}),
        }))
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

      const tags = included
        .filter((i) => i.type === "tag")
        .map((i): Record<string, unknown> => ({
          id: i.id,
          ...((i.attributes as Record<string, unknown>) || {}),
        }));

      const lines = [
        `시리즈: ${bundle.title ?? "(무제)"}`,
        `ID: ${bundle.id}`,
        `게시: ${bundle.is_published ? "예" : "아니오"}`,
        `공식: ${bundle.is_official ? "예" : "아니오"}`,
      ];

      if (tags.length) {
        const tagNames = tags.map(
          (t) => `${t.name ?? ""} (${t.domain ?? ""})`
        );
        lines.push(`태그: ${tagNames.join(", ")}`);
      }

      if (materials.length) {
        lines.push(`\n포함된 자료 (${materials.length}개):`);
        materials.forEach((m, i) => {
          lines.push(
            `  ${i + 1}차시: ${formatMaterialSummary(m as Record<string, unknown>)}`
          );
        });
      } else {
        lines.push("\n포함된 자료: 없음");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "manage_bundle",
    `시리즈(MaterialBundle)를 생성하거나 수정합니다.

시리즈는 여러 자료를 차시 순서로 묶은 커리큘럼입니다.
자료를 시리즈에 추가하려면 update_material로 자료의 material_bundle_id와 position을 설정하세요.
user_id는 인증된 사용자로 자동 설정됩니다.`,
    {
      action: z
        .string()
        .describe('수행할 작업 ("create", "update", "delete")'),
      bundle_id: z
        .string()
        .optional()
        .describe("시리즈 ID (update, delete 시 필수)"),
      title: z
        .string()
        .optional()
        .describe("시리즈 제목 (create 시 필수, 최대 64자)"),
      description: z
        .record(z.unknown())
        .optional()
        .describe("시리즈 설명 (Lexical 에디터 JSON 형식)"),
      tag_ids: z
        .array(z.string())
        .optional()
        .describe("연결할 태그 ID 목록"),
    },
    async ({ action, bundle_id, title, description }) => {
      if (action === "create") {
        if (!title) {
          return {
            content: [
              { type: "text", text: "create 시 title은 필수입니다." },
            ],
          };
        }

        const attrs: Record<string, unknown> = { title };
        if (description !== undefined) attrs.description = description;

        const payload = buildJsonApiPayload("material_bundles", attrs);
        const response = await client.createMaterialBundle(
          payload as Record<string, unknown>
        );
        const b = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `시리즈 생성 완료: [${b.id}] ${b.title}`,
            },
          ],
        };
      }

      if (action === "update") {
        if (!bundle_id) {
          return {
            content: [
              {
                type: "text",
                text: "update 시 bundle_id는 필수입니다.",
              },
            ],
          };
        }

        const attrs: Record<string, unknown> = {};
        if (title !== undefined) attrs.title = title;
        if (description !== undefined) attrs.description = description;

        if (!Object.keys(attrs).length) {
          return {
            content: [
              { type: "text", text: "수정할 항목이 없습니다." },
            ],
          };
        }

        const payload = buildJsonApiPayload(
          "material_bundles",
          attrs,
          bundle_id
        );
        const response = await client.updateMaterialBundle(
          bundle_id,
          payload as Record<string, unknown>
        );
        const b = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `시리즈 수정 완료: [${b.id}] ${b.title}`,
            },
          ],
        };
      }

      if (action === "delete") {
        if (!bundle_id) {
          return {
            content: [
              {
                type: "text",
                text: "delete 시 bundle_id는 필수입니다.",
              },
            ],
          };
        }
        await client.deleteMaterialBundle(bundle_id);
        return {
          content: [
            {
              type: "text",
              text: `시리즈 삭제 완료: ${bundle_id}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `유효하지 않은 action: ${action}. create, update, delete 중 하나를 사용하세요.`,
          },
        ],
      };
    }
  );
}
