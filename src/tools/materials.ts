import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../api/client.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
  formatMaterialSummary,
  snakeToPascal,
} from "../api/models.js";
import { convertFromMarkdown } from "../lexical/index.js";

export function registerMaterialTools(server: McpServer): void {
  server.tool(
    "search_materials",
    "자료(Material)를 검색합니다.",
    {
      query: z.string().optional().describe("검색 키워드 (자료 이름에서 검색)"),
      tag_ids: z.array(z.string()).optional().describe("필터링할 태그 ID 목록"),
      is_public: z
        .boolean()
        .optional()
        .describe("공개 여부 필터 (True=공개 자료, False/None=내 자료만)"),
      page_size: z
        .number()
        .default(20)
        .describe("페이지당 결과 수 (기본 20, 최대 100)"),
      page_number: z.number().default(1).describe("페이지 번호 (1부터 시작)"),
    },
    async ({ query, tag_ids, is_public, page_size, page_number }) => {
      const params: Record<string, string | number> = {
        "page[size]": Math.min(page_size, 100),
        "page[number]": page_number,
      };
      if (query) params["filter[query]"] = query;
      if (is_public) {
        params["filter[is_public]"] = "true";
      } else {
        const me = await client.getMe();
        const data = (me.data as Record<string, unknown>) ?? me;
        const userId = String(data.id);
        params["filter[user_id]"] = userId;
      }
      if (tag_ids?.length) {
        params["filter[tag_ids]"] = tag_ids.join(",");
      }

      const response = await client.listMaterials(params);
      const materials = extractList(response);

      if (!materials.length) {
        return { content: [{ type: "text", text: "검색 결과가 없습니다." }] };
      }

      const lines = [`자료 검색 결과 (${materials.length}건):`];
      for (const m of materials) {
        lines.push(formatMaterialSummary(m));
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_material_detail",
    "자료(Material)의 활동, 태그, 코스 흐름을 조회합니다.",
    {
      material_id: z.string().describe("조회할 자료의 ID"),
    },
    async ({ material_id }) => {
      const params = {
        include: "activities,activities.activitiable,tags,activity_transitions",
      };
      const response = await client.getMaterial(material_id, params);
      const material = extractSingle(response);

      const included =
        ((response as Record<string, unknown>).included as Array<
          Record<string, unknown>
        >) || [];

      const activities: Record<string, unknown>[] = [];
      for (const i of included) {
        if (i.type !== "activity") continue;
        const attrs = (i.attributes as Record<string, unknown>) || {};
        const a: Record<string, unknown> = { id: i.id, ...attrs };
        if (!a.activitiable_type) {
          const relationships =
            (i.relationships as Record<string, unknown>) || {};
          const activitiable =
            (relationships.activitiable as Record<string, unknown>) || {};
          const rel = (activitiable.data as Record<string, unknown>) || {};
          if (rel.id) {
            a.activitiable_id = rel.id;
            a.activitiable_type = snakeToPascal(String(rel.type || ""));
          }
        }
        activities.push(a);
      }

      const tags = included
        .filter((i) => i.type === "tag")
        .map(
          (i): Record<string, unknown> => ({
            id: i.id,
            ...((i.attributes as Record<string, unknown>) || {}),
          }),
        );

      const transitions = included
        .filter((i) => i.type === "activity_transition")
        .map(
          (i): Record<string, unknown> => ({
            id: i.id,
            ...((i.attributes as Record<string, unknown>) || {}),
          }),
        );

      const lines = [
        `자료: ${material.name ?? "(무제)"}`,
        `ID: ${material.id}`,
        `공개: ${material.is_public ? "예" : "아니오"}`,
        `공식: ${material.is_official ? "예" : "아니오"}`,
        `레벨: ${material.level ?? 0}`,
      ];

      if (tags.length) {
        const tagNames = tags.map((t) => `${t.name ?? ""} (${t.domain ?? ""})`);
        lines.push(`태그: ${tagNames.join(", ")}`);
      }

      if (activities.length) {
        lines.push(`\n활동 (${activities.length}개):`);
        for (const a of activities) {
          const depthVal = Number(a.depth) || 0;
          const depthPrefix = "  ".repeat(depthVal);
          let actType = String(a.activitiable_type || "");
          const hasActivitiable = !!a.activitiable_id;
          if (!actType) {
            actType = !hasActivitiable ? "미연결" : "?";
          }
          const needsProblems = ["QuizActivity", "SheetActivity"].includes(
            actType,
          );
          const problemInfo = needsProblems ? ", 문제 연결 필요" : "";
          const activitiableInfo = hasActivitiable
            ? `, activitiable_id: ${a.activitiable_id}`
            : "";
          const displayDepth = depthVal + 1; // 0-indexed → 1-indexed
          lines.push(
            `  ${depthPrefix}[${a.id}] ${
              a.name ?? "(무제)"
            } (type: ${actType}, depth: ${displayDepth}${activitiableInfo}${problemInfo})`,
          );
        }
      } else {
        lines.push("\n활동: 없음");
      }

      if (transitions.length) {
        const activityNames: Record<string, string> = {};
        for (const a of activities) {
          activityNames[String(a.id)] = String(a.name ?? "(무제)");
        }

        lines.push(`\n코스 흐름 (${transitions.length}개):`);
        for (const t of transitions) {
          const beforeId = String(t.before_activity_id ?? "?");
          const afterId = String(t.after_activity_id ?? "?");
          const level = t.level as string | undefined;
          const beforeName = activityNames[beforeId] ?? beforeId;
          const afterName = activityNames[afterId] ?? afterId;
          if (level) {
            lines.push(
              `  [${beforeId}] ${beforeName} →(${level}) [${afterId}] ${afterName}`,
            );
          } else {
            lines.push(
              `  [${beforeId}] ${beforeName} → [${afterId}] ${afterName}`,
            );
          }
        }
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "manage_materials",
    "자료(Material) CRUD.",
    {
      action: z.enum(["create", "update", "duplicate"]).describe("수행할 작업"),
      material_id: z
        .string()
        .optional()
        .describe("자료 ID (update, duplicate 시 필수)"),
      name: z
        .string()
        .optional()
        .describe("자료 이름 (create 시 필수, 최대 255자)"),
      is_public: z.boolean().optional().describe("공개 여부 (비가역)"),
      tag_ids: z.array(z.string()).optional().describe("태그 ID 목록"),
      body: z.string().optional().describe("자료 본문 (markdown)"),
    },
    async ({ action, material_id, name, is_public, tag_ids, body }) => {
      if (action === "create") {
        if (!name) {
          return {
            content: [{ type: "text", text: "create 시 name은 필수입니다." }],
          };
        }
        const attrs: Record<string, unknown> = {
          name,
          is_public: is_public ?? false,
        };
        if (tag_ids?.length) attrs.tag_ids = tag_ids;
        if (body !== undefined) attrs.body = convertFromMarkdown(body);

        const payload = buildJsonApiPayload("materials", attrs);
        const response = await client.createMaterial(
          payload as Record<string, unknown>,
        );
        const mat = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `자료 생성 완료: [${mat.id}] ${mat.name}`,
            },
          ],
        };
      }

      if (action === "update") {
        if (!material_id) {
          return {
            content: [
              { type: "text", text: "update 시 material_id는 필수입니다." },
            ],
          };
        }
        const attrs: Record<string, unknown> = {};
        if (name !== undefined) attrs.name = name;
        if (is_public !== undefined) attrs.is_public = is_public;
        if (tag_ids !== undefined) attrs.tag_ids = tag_ids;
        if (body !== undefined) attrs.body = convertFromMarkdown(body);

        if (!Object.keys(attrs).length) {
          return {
            content: [{ type: "text", text: "수정할 항목이 없습니다." }],
          };
        }

        const payload = buildJsonApiPayload("materials", attrs, material_id);
        const response = await client.updateMaterial(
          material_id,
          payload as Record<string, unknown>,
        );
        const mat = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `자료 수정 완료: [${mat.id}] ${mat.name}`,
            },
          ],
        };
      }

      if (action === "duplicate") {
        if (!material_id) {
          return {
            content: [
              {
                type: "text",
                text: "duplicate 시 material_id는 필수입니다.",
              },
            ],
          };
        }
        const response = await client.duplicateMaterial(material_id);
        const mat = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `자료 복제 완료: [${mat.id}] ${mat.name} (원본: ${material_id})`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `유효하지 않은 action: ${action}. create, update, duplicate 중 하나를 사용하세요.`,
          },
        ],
      };
    },
  );
}
