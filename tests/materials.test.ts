import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

// Mock CodleClient constructor - must mock BEFORE importing commands
const mockClient = {
  getMe: vi.fn(),
  listMaterials: vi.fn(),
  getMaterial: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  duplicateMaterial: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));

// Import commands AFTER mock
import MaterialSearch from "../src/commands/material/search.js";
import MaterialGet from "../src/commands/material/get.js";
import MaterialCreate from "../src/commands/material/create.js";
import MaterialUpdate from "../src/commands/material/update.js";
import MaterialDuplicate from "../src/commands/material/duplicate.js";
import { runCommand } from "./run-command.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.getMe.mockResolvedValue({
    data: { id: "test-user-123", type: "user", attributes: {} },
  });
});

describe("material search", () => {
  it("basic search (my materials)", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "1", name: "테스트 자료", is_public: false },
      ]),
    );

    const output = await runCommand(MaterialSearch, [
      "--query",
      "테스트",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    expect(output).toContain("테스트 자료");

    expect(mockClient.getMe).toHaveBeenCalled();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[query]"]).toBe("테스트");
    expect(callParams["filter[user_id]"]).toBe("test-user-123");
    expect(callParams["filter[is_public]"]).toBeUndefined();
  });

  it("public search no user_id", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "2", name: "공개자료", is_public: true },
      ]),
    );

    await runCommand(MaterialSearch, [
      "--is-public",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);

    expect(mockClient.getMe).not.toHaveBeenCalled();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[is_public]"]).toBe("true");
    expect(callParams["filter[user_id]"]).toBeUndefined();
  });

  it("empty results", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    const output = await runCommand(MaterialSearch, [
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([]);
  });

  it("tag_ids filter", async () => {
    mockClient.listMaterials.mockResolvedValue({ data: [] });
    await runCommand(MaterialSearch, [
      "--tag-ids",
      "10",
      "--tag-ids",
      "20",
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[tag_ids]"]).toBe("10,20");
  });

  it("is-public omitted calls getMe and sends user_id", async () => {
    mockClient.listMaterials.mockResolvedValue(
      makeJsonApiListResponse("material", [
        { id: "3", name: "내 자료", is_public: false },
      ]),
    );

    const output = await runCommand(MaterialSearch, [
      "--page-size",
      "20",
      "--page-number",
      "1",
    ]);
    expect(output).toContain("내 자료");

    expect(mockClient.getMe).toHaveBeenCalledOnce();
    const callParams = mockClient.listMaterials.mock.calls[0][0];
    expect(callParams["filter[user_id]"]).toBe("test-user-123");
    expect(callParams["filter[is_public]"]).toBeUndefined();
  });
});

describe("material get", () => {
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
          attributes: {
            name: "활동1",
            depth: 0,
            activitiable_type: "QuizActivity",
          },
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

    const output = await runCommand(MaterialGet, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.material.name).toBe("테스트 자료");
    expect(parsed.activities).toHaveLength(2);
    expect(parsed.tags).toHaveLength(1);
    expect(parsed.tags[0].name).toBe("AI");
    expect(parsed.transitions).toHaveLength(1);
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

    const output = await runCommand(MaterialGet, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.activities).toHaveLength(0);
  });
});

describe("material create", () => {
  it("create", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "새 자료" }),
    );

    const output = await runCommand(MaterialCreate, ["--name", "새 자료"]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("새 자료");
  });

  it("create with body (markdown -> Lexical conversion)", async () => {
    mockClient.createMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "본문 자료" }),
    );

    const output = await runCommand(MaterialCreate, [
      "--name",
      "본문 자료",
      "--body",
      "본문 내용",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("본문 자료");

    const payload = mockClient.createMaterial.mock.calls[0][0];
    const body = payload.data.attributes.body;
    expect(body.root).toBeDefined();
    expect(body.root.type).toBe("root");
    // Lexical로 변환되어 paragraph > text 구조가 됨
    const paragraph = body.root.children[0];
    expect(paragraph.type).toBe("paragraph");
    const textNode = paragraph.children[0];
    expect(textNode.text).toBe("본문 내용");
  });

  it("create without name errors", async () => {
    // --name is required by oclif, so the command will fail before calling createMaterial
    await runCommand(MaterialCreate, []);
    expect(mockClient.createMaterial).not.toHaveBeenCalled();
  });
});

describe("material update", () => {
  it("update", async () => {
    mockClient.updateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "수정됨" }),
    );

    const output = await runCommand(MaterialUpdate, ["1", "--name", "수정됨"]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("수정됨");
  });

  it("update with body (markdown -> Lexical conversion)", async () => {
    mockClient.updateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "1", { name: "기존 자료" }),
    );

    const output = await runCommand(MaterialUpdate, [
      "1",
      "--body",
      "수정된 본문",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("1");

    const payload = mockClient.updateMaterial.mock.calls[0][1];
    const body = payload.data.attributes.body;
    expect(body.root).toBeDefined();
    expect(body.root.type).toBe("root");
  });

  it("update without id errors", async () => {
    // id is a required positional arg, so the command will fail before calling updateMaterial
    await runCommand(MaterialUpdate, ["--name", "수정됨"]);
    expect(mockClient.updateMaterial).not.toHaveBeenCalled();
  });

  it("update no changes", async () => {
    const output = await runCommand(MaterialUpdate, ["1"]);
    expect(output).toContain("수정할 항목이 없습니다");
  });
});

describe("material duplicate", () => {
  it("duplicate", async () => {
    mockClient.duplicateMaterial.mockResolvedValue(
      makeJsonApiResponse("material", "2", { name: "복제됨" }),
    );

    const output = await runCommand(MaterialDuplicate, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("2");
    expect(parsed.name).toBe("복제됨");
  });

  it("duplicate without id errors", async () => {
    // id is a required positional arg, so the command will fail before calling duplicateMaterial
    await runCommand(MaterialDuplicate, []);
    expect(mockClient.duplicateMaterial).not.toHaveBeenCalled();
  });
});
