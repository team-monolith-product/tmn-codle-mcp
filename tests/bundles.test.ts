import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    listMaterialBundles: vi.fn(),
    getMaterialBundle: vi.fn(),
    createMaterialBundle: vi.fn(),
    updateMaterialBundle: vi.fn(),
    deleteMaterialBundle: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

const { client } = await import("../src/api/client.js");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBundleTools } from "../src/tools/bundles.js";

const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
registerBundleTools(mockServer);

const mockClient = client as unknown as Record<string, ReturnType<typeof vi.fn>>;

function getText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0].text;
}

beforeEach(() => {
  vi.clearAllMocks();
  (client as Record<string, unknown>).userId = "test-user-123";
});

describe("list_bundles", () => {
  it("default unpublished with user_id", async () => {
    mockClient.listMaterialBundles.mockResolvedValue(
      makeJsonApiListResponse("material_bundle", [
        { id: "1", title: "시리즈1", is_published: false },
      ])
    );

    const result = await toolHandlers.list_bundles({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("시리즈1");

    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["filter[is_published_eq]"]).toBe("false");
    expect(callParams["filter[user_id_eq]"]).toBe("test-user-123");
  });

  it("published no user_id", async () => {
    mockClient.listMaterialBundles.mockResolvedValue(
      makeJsonApiListResponse("material_bundle", [
        { id: "2", title: "공개시리즈", is_published: true },
      ])
    );

    await toolHandlers.list_bundles({
      is_published: true,
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["filter[is_published_eq]"]).toBe("true");
    expect(callParams["filter[user_id_eq]"]).toBeUndefined();
  });

  it("unpublished without user_id", async () => {
    (client as Record<string, unknown>).userId = "";
    const result = await toolHandlers.list_bundles({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("인증된 user_id가 없어");
  });

  it("query compact_title", async () => {
    mockClient.listMaterialBundles.mockResolvedValue(
      makeJsonApiListResponse("material_bundle", [])
    );
    await toolHandlers.list_bundles({
      query: "AI 교육",
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["filter[compact_title]"]).toBe("AI교육");
  });

  it("empty result", async () => {
    mockClient.listMaterialBundles.mockResolvedValue({ data: [] });
    const result = await toolHandlers.list_bundles({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("시리즈가 없습니다");
  });

  it("400 error debug message", async () => {
    mockClient.listMaterialBundles.mockRejectedValue(
      new CodleAPIError(400, "IncompleteFilter")
    );
    const result = await toolHandlers.list_bundles({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("시리즈 조회 실패 (400)");
    expect(getText(result)).toContain("유효한 필터 조합");
    expect(getText(result)).toContain("전송된 파라미터");
  });

  it("403 error debug message", async () => {
    mockClient.listMaterialBundles.mockRejectedValue(
      new CodleAPIError(403, "ForbiddenUser")
    );
    const result = await toolHandlers.list_bundles({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("시리즈 조회 실패 (403)");
    expect(getText(result)).toContain("유효한 필터 조합");
  });

  it("500 error raises", async () => {
    mockClient.listMaterialBundles.mockRejectedValue(
      new CodleAPIError(500, "Internal")
    );
    await expect(
      toolHandlers.list_bundles({ page_size: 20, page_number: 1 })
    ).rejects.toThrow(CodleAPIError);
  });

  it("tag_ids filter", async () => {
    mockClient.listMaterialBundles.mockResolvedValue({ data: [] });
    await toolHandlers.list_bundles({
      tag_ids: ["10", "20"],
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["filter[material_bundle_category_tag_ids]"]).toBe(
      "10,20"
    );
  });

  it("is_official filter", async () => {
    mockClient.listMaterialBundles.mockResolvedValue({ data: [] });
    await toolHandlers.list_bundles({
      is_official: true,
      page_size: 20,
      page_number: 1,
    });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["filter[is_official_eq]"]).toBe("true");
  });

  it("pagination", async () => {
    mockClient.listMaterialBundles.mockResolvedValue({ data: [] });
    await toolHandlers.list_bundles({ page_size: 50, page_number: 3 });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["page[size]"]).toBe(50);
    expect(callParams["page[number]"]).toBe(3);
  });

  it("page_size max 100", async () => {
    mockClient.listMaterialBundles.mockResolvedValue({ data: [] });
    await toolHandlers.list_bundles({
      page_size: 200,
      page_number: 1,
    });
    const callParams = mockClient.listMaterialBundles.mock.calls[0][0];
    expect(callParams["page[size]"]).toBe(100);
  });
});

describe("get_bundle_detail", () => {
  it("basic", async () => {
    mockClient.getMaterialBundle.mockResolvedValue({
      data: {
        id: "1",
        type: "material_bundle",
        attributes: {
          title: "AI 시리즈",
          is_published: true,
          is_official: false,
        },
      },
      included: [
        {
          id: "10",
          type: "material",
          attributes: { name: "1차시", position: 0, is_public: false },
        },
        {
          id: "11",
          type: "material",
          attributes: { name: "2차시", position: 1, is_public: false },
        },
        {
          id: "t1",
          type: "tag",
          attributes: { name: "AI", domain: "category" },
        },
      ],
    });

    const result = await toolHandlers.get_bundle_detail({ bundle_id: "1" });
    expect(getText(result)).toContain("AI 시리즈");
    expect(getText(result)).toContain("1차시");
    expect(getText(result)).toContain("2차시");
    expect(getText(result)).toContain("AI (category)");
  });

  it("no materials", async () => {
    mockClient.getMaterialBundle.mockResolvedValue({
      data: {
        id: "1",
        type: "material_bundle",
        attributes: {
          title: "빈 시리즈",
          is_published: false,
          is_official: false,
        },
      },
      included: [],
    });

    const result = await toolHandlers.get_bundle_detail({ bundle_id: "1" });
    expect(getText(result)).toContain("포함된 자료: 없음");
  });
});

describe("manage_bundle", () => {
  it("create", async () => {
    mockClient.createMaterialBundle.mockResolvedValue(
      makeJsonApiResponse("material_bundle", "1", { title: "새 시리즈" })
    );
    const result = await toolHandlers.manage_bundle({
      action: "create",
      title: "새 시리즈",
    });
    expect(getText(result)).toContain("생성 완료");
    expect(getText(result)).toContain("새 시리즈");
  });

  it("create missing title", async () => {
    const result = await toolHandlers.manage_bundle({ action: "create" });
    expect(getText(result)).toContain("title은 필수");
  });

  it("update", async () => {
    mockClient.updateMaterialBundle.mockResolvedValue(
      makeJsonApiResponse("material_bundle", "1", { title: "수정됨" })
    );
    const result = await toolHandlers.manage_bundle({
      action: "update",
      bundle_id: "1",
      title: "수정됨",
    });
    expect(getText(result)).toContain("수정 완료");
  });

  it("update missing bundle_id", async () => {
    const result = await toolHandlers.manage_bundle({ action: "update" });
    expect(getText(result)).toContain("bundle_id는 필수");
  });

  it("update no changes", async () => {
    const result = await toolHandlers.manage_bundle({
      action: "update",
      bundle_id: "1",
    });
    expect(getText(result)).toContain("수정할 항목이 없습니다");
  });

  it("delete", async () => {
    mockClient.deleteMaterialBundle.mockResolvedValue({});
    const result = await toolHandlers.manage_bundle({
      action: "delete",
      bundle_id: "1",
    });
    expect(getText(result)).toContain("삭제 완료");
  });

  it("delete missing bundle_id", async () => {
    const result = await toolHandlers.manage_bundle({ action: "delete" });
    expect(getText(result)).toContain("bundle_id는 필수");
  });

  it("invalid action", async () => {
    const result = await toolHandlers.manage_bundle({ action: "invalid" });
    expect(getText(result)).toContain("유효하지 않은 action");
  });
});
