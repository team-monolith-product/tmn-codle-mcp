import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../api/client.js";
import {
  searchMaterials,
  getMaterialDetail,
  createMaterial,
  updateMaterial,
  duplicateMaterial,
} from "../services/material.service.js";

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
      const result = await searchMaterials(client, {
        query,
        tag_ids,
        is_public,
        page_size,
        page_number,
      });
      return { content: [{ type: "text", text: result.text }] };
    },
  );

  server.tool(
    "get_material_detail",
    "자료(Material)의 활동, 태그, 코스 흐름을 조회합니다.",
    {
      material_id: z.string().describe("조회할 자료의 ID"),
    },
    async ({ material_id }) => {
      const result = await getMaterialDetail(client, material_id);
      return { content: [{ type: "text", text: result.text }] };
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
        const result = await createMaterial(client, {
          name,
          is_public,
          tag_ids,
          body,
        });
        return { content: [{ type: "text", text: result.text }] };
      }

      if (action === "update") {
        if (!material_id) {
          return {
            content: [
              { type: "text", text: "update 시 material_id는 필수입니다." },
            ],
          };
        }
        const result = await updateMaterial(client, {
          material_id,
          name,
          is_public,
          tag_ids,
          body,
        });
        return { content: [{ type: "text", text: result.text }] };
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
        const result = await duplicateMaterial(client, material_id);
        return { content: [{ type: "text", text: result.text }] };
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
