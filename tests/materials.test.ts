import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    listMaterials: vi.fn(),
    getMaterial: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    duplicateMaterial: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

const { client } = await import("../src/api/client.js");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMaterialTools } from "../src/tools/materials.js";

const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
registerMaterialTools(mockServer);

const mockClient = client as unknown as Record<string, ReturnType<typeof vi.fn>>;

function getText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0].text;
}

beforeEach(() => {
  vi.clearAllMocks();
  (client as Record<string, unknown>).userId = "test-user-123";
});

describe("search_materials", () => {
  it("basic search", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "1", name: "테스트 자료", is_public: false },
      ])
    );

    const result = await toolHandlers.search_materials({
      query: "테스트",
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("테스트 자료");

    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[query]"]).toBe("테스트");
    expect(callParams["filter[user_id]"]).toBe("test-user-123");
  });

  it("public search no user_id", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "2", name: "공개자료", is_public: true },
      ])
    );

    await toolHandlers.search_materials({
      is_public: true,
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[is_public]"]).toBe("true");
    expect(callParams["filter[user_id]"]).toBeUndefined();
  });

  it("empty results", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    const result = await toolHandlers.search_materials({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("검색 결과가 없습니다");
  });

  it("tag_ids filter", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    await toolHandlers.search_materials({
      tag_ids: ["10", "20"],
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[tag_ids]"]).toBe("10,20");
  });
});

describe("get_material_detail", () => {
  it("basic with activities and transitions", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: {
          name: "테스트 자료",
          is_public: false,
          is_official: false,
          level: 0,
        },
      },
      included: [
        {
          id: "10",
          type: "activity",
          attributes: { name: "활동1", depth: 0, activitiable_type: "QuizActivity" },
          relationships: {
            activitiable: { data: { type: "quiz_activity", id: "q1" } },
          },
        },
        {
          id: "20",
          type: "activity",
          attributes: { name: "활동2", depth: 0 },
          relationships: {
            activitiable: { data: { type: "html_activity", id: "h1" } },
          },
        },
        {
          id: "t1",
          type: "activity_transition",
          attributes: {
            before_activity_id: "10",
            after_activity_id: "20",
          },
        },
        {
          id: "tag1",
          type: "tag",
          attributes: { name: "AI", domain: "category" },
        },
      ],
    });

    const result = await toolHandlers.get_material_detail({
      material_id: "1",
    });
    const text = getText(result);
    expect(text).toContain("테스트 자료");
    expect(text).toContain("활동1");
    expect(text).toContain("활동2");
    expect(text).toContain("AI (category)");
    expect(text).toContain("코스 흐름");
  });

  it("no activities", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: {
        id: "1",
        type: "material",
        attributes: { name: "빈 자료", is_public: false, is_official: false },
      },
      included: [],
    });

    const result = await toolHandlers.get_material_detail({
      material_id: "1",
    });
    expect(getText(result)).toContain("활동: 없음");
  });
});

describe("create_material", () => {
  it("basic create", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "새 자료" })
    );

    const result = await toolHandlers.create_material({
      name: "새 자료",
      is_public: false,
    });
    expect(getText(result)).toContain("자료 생성 완료");
    expect(getText(result)).toContain("새 자료");
  });

  it("with bundle", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "시리즈 자료" })
    );

    await toolHandlers.create_material({
      name: "시리즈 자료",
      is_public: false,
      material_bundle_id: "b1",
      position: 0,
    });
    const callArgs = mockClient.createMaterial.mock.calls[0][0];
    expect(callArgs.data.attributes.material_bundle_id).toBe("b1");
    expect(callArgs.data.attributes.position).toBe(0);
  });
});

describe("update_material", () => {
  it("update name", async () => {
    mockClient.updateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "수정됨" })
    );

    const result = await toolHandlers.update_material({
      material_id: "1",
      name: "수정됨",
    });
    expect(getText(result)).toContain("자료 수정 완료");
  });

  it("no changes", async () => {
    const result = await toolHandlers.update_material({
      material_id: "1",
    });
    expect(getText(result)).toContain("수정할 항목이 없습니다");
  });
});

describe("duplicate_material", () => {
  it("basic duplicate", async () => {
    mockClient.duplicateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "2", { name: "복제됨" })
    );

    const result = await toolHandlers.duplicate_material({
      material_id: "1",
    });
    expect(getText(result)).toContain("자료 복제 완료");
    expect(getText(result)).toContain("원본: 1");
  });
});
