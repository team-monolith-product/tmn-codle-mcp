import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    ensureAuth: vi.fn(),
    request: vi.fn(),
    createProblem: vi.fn(),
    updateProblem: vi.fn(),
    deleteProblem: vi.fn(),
    listProblemCollections: vi.fn(),
    createPCP: vi.fn(),
    deletePCP: vi.fn(),
    doManyPCP: vi.fn(),
    listBoards: vi.fn(),
    updateBoard: vi.fn(),
    updateSheetActivity: vi.fn(),
    updateEmbeddedActivity: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

vi.mock("../src/lexical/index.js", () => ({
  buildSelectBlock: vi.fn(
    (choices: Array<{ text: string; isAnswer: boolean }>) => ({
      root: {
        type: "root",
        children: [{ type: "problem-select", selections: choices }],
      },
    }),
  ),
  buildInputBlock: vi.fn((solutions: string[]) => ({
    root: {
      type: "root",
      children: [{ type: "problem-input", solutions }],
    },
  })),
  convertFromMarkdown: vi.fn((md: string) => ({
    root: { type: "root", children: [{ type: "paragraph", text: md }] },
  })),
}));

const { client } = await import("../src/api/client.js");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProblemTools } from "../src/tools/problems.js";
import { registerActivitiableTools } from "../src/tools/activitiables.js";

const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
registerProblemTools(mockServer);
registerActivitiableTools(mockServer);

const mockClient = client as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function getText(result: {
  content: Array<{ type: string; text: string }>;
}): string {
  return result.content[0].text;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===== manage_problems =====

describe("manage_problems create", () => {
  it("missing required params", async () => {
    const result = await toolHandlers.manage_problems({ action: "create" });
    expect(getText(result)).toContain("필수");
  });

  it("successful create with choices (quiz)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "OX 문제" }),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "OX 문제",
      problem_type: "quiz",
      choices: [
        { text: "O", isAnswer: true },
        { text: "X", isAnswer: false },
      ],
    });
    expect(getText(result)).toContain("문제 생성 완료");
    expect(getText(result)).toContain("10");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.title).toBe("OX 문제");
    expect(payload.data.attributes.problem_type).toBe("quiz");
    expect(payload.data.attributes.blocks).toBeDefined();
  });

  it("successful create with solutions (input)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "11", { title: "주관식" }),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "주관식",
      problem_type: "quiz",
      solutions: ["42"],
    });
    expect(getText(result)).toContain("문제 생성 완료");
  });

  it("create without blocks", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "12", { title: "서술형" }),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "서술형",
      problem_type: "descriptive",
      content: "설명을 작성하세요",
    });
    expect(getText(result)).toContain("문제 생성 완료");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.blocks).toBeUndefined();
    expect(payload.data.attributes.content).toBe("설명을 작성하세요");
  });

  it("create API error", async () => {
    mockClient.createProblem.mockRejectedValue(
      new CodleAPIError(422, "Validation failed"),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "실패",
      problem_type: "quiz",
    });
    expect(getText(result)).toContain("문제 생성 실패");
  });
});

describe("manage_problems update", () => {
  it("missing problem_id", async () => {
    const result = await toolHandlers.manage_problems({ action: "update" });
    expect(getText(result)).toContain("problem_id는 필수");
  });

  it("nothing to update", async () => {
    const result = await toolHandlers.manage_problems({
      action: "update",
      problem_id: "10",
    });
    expect(getText(result)).toContain("수정할 항목이 없습니다");
  });

  it("successful update", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "수정됨" }),
    );

    const result = await toolHandlers.manage_problems({
      action: "update",
      problem_id: "10",
      title: "수정됨",
    });
    expect(getText(result)).toContain("문제 수정 완료");
  });
});

describe("manage_problems delete", () => {
  it("missing problem_id", async () => {
    const result = await toolHandlers.manage_problems({ action: "delete" });
    expect(getText(result)).toContain("problem_id는 필수");
  });

  it("successful delete", async () => {
    mockClient.deleteProblem.mockResolvedValue({});

    const result = await toolHandlers.manage_problems({
      action: "delete",
      problem_id: "10",
    });
    expect(getText(result)).toContain("문제 삭제 완료");
  });

  it("delete API error", async () => {
    mockClient.deleteProblem.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );

    const result = await toolHandlers.manage_problems({
      action: "delete",
      problem_id: "999",
    });
    expect(getText(result)).toContain("문제 삭제 실패");
  });
});

// ===== manage_problem_collection_problems =====

describe("manage_problem_collection_problems add", () => {
  it("no problem collection found", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", []),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "add",
      activity_id: "1",
      problem_id: "10",
    });
    expect(getText(result)).toContain("ProblemCollection이 없습니다");
  });

  it("missing problem_id", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "add",
      activity_id: "1",
    });
    expect(getText(result)).toContain("problem_id는 필수");
  });

  it("successful add", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );
    mockClient.createPCP.mockResolvedValue(
      makeJsonApiResponse("problem_collections_problem", "pcp1", {
        problem_collection_id: "pc1",
        problem_id: "10",
      }),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "add",
      activity_id: "1",
      problem_id: "10",
      point: 5,
    });
    expect(getText(result)).toContain("문제 연결 완료");

    const payload = mockClient.createPCP.mock.calls[0][0];
    expect(payload.data.attributes.problem_collection_id).toBe("pc1");
    expect(payload.data.attributes.problem_id).toBe("10");
    expect(payload.data.attributes.point).toBe(5);
  });
});

describe("manage_problem_collection_problems remove", () => {
  it("successful remove", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );
    mockClient.request.mockResolvedValue(
      makeJsonApiListResponse("problem_collections_problem", [
        { id: "pcp1", problem_id: "10" },
      ]),
    );
    mockClient.deletePCP.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "remove",
      activity_id: "1",
      problem_id: "10",
    });
    expect(getText(result)).toContain("문제 연결 해제 완료");
  });

  it("problem not found in collection", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );
    mockClient.request.mockResolvedValue(
      makeJsonApiListResponse("problem_collections_problem", []),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "remove",
      activity_id: "1",
      problem_id: "999",
    });
    expect(getText(result)).toContain("찾을 수 없습니다");
  });
});

describe("manage_problem_collection_problems reorder", () => {
  it("missing problem_ids", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "reorder",
      activity_id: "1",
    });
    expect(getText(result)).toContain("problem_ids는 필수");
  });

  it("successful reorder", async () => {
    mockClient.listProblemCollections.mockResolvedValue(
      makeJsonApiListResponse("problem_collection", [{ id: "pc1" }]),
    );
    mockClient.request.mockResolvedValue(
      makeJsonApiListResponse("problem_collections_problem", [
        { id: "pcp1", problem_id: "10" },
        { id: "pcp2", problem_id: "20" },
        { id: "pcp3", problem_id: "30" },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collection_problems({
      action: "reorder",
      activity_id: "1",
      problem_ids: ["30", "10", "20"],
    });
    expect(getText(result)).toContain("문제 정렬 완료");
    expect(getText(result)).toContain("30 → 10 → 20");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_update).toEqual([
      { id: "pcp3", attributes: { position: 0 } },
      { id: "pcp1", attributes: { position: 1 } },
      { id: "pcp2", attributes: { position: 2 } },
    ]);
  });
});

// ===== update_activitiable =====

function makeActivitiableResponse(
  activitiableId: string | undefined,
  type: string,
) {
  return {
    data: {
      id: "1",
      type: "activity",
      attributes: {},
      relationships: {
        activitiable: {
          data: activitiableId ? { id: activitiableId, type } : {},
        },
      },
    },
  };
}

describe("update_activitiable — BoardActivity", () => {
  it("no valid params for board", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ba1", "board_activity"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
    });
    expect(getText(result)).toContain("content 또는 name 중 하나 이상 필요");
  });

  it("no board found", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ba1", "board_activity"),
    );
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", []),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      content: "# Hello",
    });
    expect(getText(result)).toContain("Board가 없습니다");
  });

  it("successful update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ba1", "board_activity"),
    );
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1", name: "보드" }]),
    );
    mockClient.updateBoard.mockResolvedValue(
      makeJsonApiResponse("board", "b1", { name: "보드" }),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      content: "# 안내문",
      name: "새 보드",
    });
    expect(getText(result)).toContain("보드 업데이트 완료");

    const payload = mockClient.updateBoard.mock.calls[0][1];
    expect(payload.data.attributes.lexical).toBeDefined();
    expect(payload.data.attributes.name).toBe("새 보드");
  });

  it("API error on board update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ba1", "board_activity"),
    );
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockRejectedValue(
      new CodleAPIError(422, "Invalid"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      content: "# test",
    });
    expect(getText(result)).toContain("보드 업데이트 실패");
  });
});

describe("update_activitiable — SheetActivity", () => {
  it("no content for sheet", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("sa1", "sheet_activity"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
    });
    expect(getText(result)).toContain("content는 필수");
  });

  it("successful update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("sa1", "sheet_activity"),
    );
    mockClient.updateSheetActivity.mockResolvedValue(
      makeJsonApiResponse("sheet_activity", "sa1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      content: "# 활동지 설명",
    });
    expect(getText(result)).toContain("활동지 설명 업데이트 완료");

    const payload = mockClient.updateSheetActivity.mock.calls[0][1];
    expect(payload.data.attributes.description).toBeDefined();
  });

  it("API error on activity fetch", async () => {
    mockClient.request.mockRejectedValue(new CodleAPIError(404, "Not found"));

    const result = await toolHandlers.update_activitiable({
      activity_id: "999",
      content: "# test",
    });
    expect(getText(result)).toContain("Activity 조회 실패");
  });
});

describe("update_activitiable — EmbeddedActivity", () => {
  it("nothing to update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
    });
    expect(getText(result)).toContain("url 또는 goals 중 하나 이상 필요");
  });

  it("no activitiable found", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse(undefined, "embedded_activity"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      url: "https://example.com",
    });
    expect(getText(result)).toContain("activitiable을 찾을 수 없습니다");
  });

  it("url only", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "ea1", {
        url: "https://example.com",
      }),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      url: "https://example.com",
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBe("https://example.com");
    expect(payload.data.attributes.goals).toBeUndefined();
  });

  it("goals only", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "ea1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      goals: ["목표1", "목표2"],
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBeUndefined();
    expect(payload.data.attributes.goals).toHaveLength(2);
  });

  it("url + goals together", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "ea1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      url: "https://codle.io",
      goals: ["학습목표"],
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBe("https://codle.io");
    expect(payload.data.attributes.goals).toHaveLength(1);
  });

  it("API error on update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );
    mockClient.updateEmbeddedActivity.mockRejectedValue(
      new CodleAPIError(422, "Invalid URL"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      url: "bad-url",
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 실패");
  });
});

describe("update_activitiable — unsupported type", () => {
  it("returns error for unsupported type", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("va1", "video_activity"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "1",
      url: "https://example.com",
    });
    expect(getText(result)).toContain("지원하지 않는 유형");
  });
});
