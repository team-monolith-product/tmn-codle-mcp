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

  it("create descriptive with content converts to blocks", async () => {
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
    expect(payload.data.attributes.blocks).toBeDefined();
    expect(payload.data.attributes.blocks.root.type).toBe("root");
    expect(payload.data.attributes.content).toBe("설명을 작성하세요");
  });

  it("create sheet with content converts to blocks", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "13", { title: "활동지" }),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "활동지",
      problem_type: "sheet",
      content: "문제 내용",
    });
    expect(getText(result)).toContain("문제 생성 완료");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.blocks).toBeDefined();
    expect(payload.data.attributes.content).toBe("문제 내용");
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

// ===== manage_problems create + activity_id =====

/** Activity 응답을 PC relationship 포함하여 생성 */
function makeActivityWithPc(pcId: string | null) {
  const pcRelData = pcId ? [{ id: pcId, type: "problem_collection" }] : [];
  return {
    data: {
      id: "1",
      type: "activity",
      attributes: {},
      relationships: {
        problem_collections: { data: pcRelData },
      },
    },
    included: pcId
      ? [
          {
            id: pcId,
            type: "problem_collection",
            attributes: { name: "PC", activity_id: "1" },
          },
        ]
      : [],
  };
}

describe("manage_problems create with activity_id", () => {
  it("creates problem and links to activity", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "문제" }),
    );
    mockClient.request.mockResolvedValue(makeActivityWithPc("pc1"));
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "문제",
      problem_type: "quiz",
      activity_id: "1",
      choices: [
        { text: "O", isAnswer: true },
        { text: "X", isAnswer: false },
      ],
    });
    expect(getText(result)).toContain("문제 생성 완료");
    expect(getText(result)).toContain("activity=1에 연결됨");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create[0].attributes.problem_collection_id).toBe(
      "pc1",
    );
    expect(payload.data_to_create[0].attributes.problem_id).toBe("10");
  });

  it("warns when activity has no problem collection", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "문제" }),
    );
    mockClient.request.mockResolvedValue(makeActivityWithPc(null));

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "문제",
      problem_type: "quiz",
      activity_id: "1",
    });
    expect(getText(result)).toContain("문제 생성 완료");
    expect(getText(result)).toContain("활동 연결 실패");
  });

  it("warns when PCP creation fails", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "문제" }),
    );
    mockClient.request.mockResolvedValue(makeActivityWithPc("pc1"));
    mockClient.doManyPCP.mockRejectedValue(
      new CodleAPIError(422, "PCP failed"),
    );

    const result = await toolHandlers.manage_problems({
      action: "create",
      title: "문제",
      problem_type: "quiz",
      activity_id: "1",
    });
    expect(getText(result)).toContain("문제 생성 완료");
    expect(getText(result)).toContain("활동 연결 실패");
  });
});

// ===== manage_problem_collection_problems =====

/** Activity 응답을 PC relationship + PCP included で生成 */
function makeActivityWithPcps(
  pcId: string | null,
  pcps: Array<{
    id: string;
    problem_id: string;
    position: number;
  }>,
) {
  const pcRelData = pcId ? [{ id: pcId, type: "problem_collection" }] : [];
  const includedItems: Array<Record<string, unknown>> = [];
  if (pcId) {
    includedItems.push({
      id: pcId,
      type: "problem_collection",
      attributes: { name: "PC", activity_id: "1" },
    });
  }
  for (const pcp of pcps) {
    includedItems.push({
      id: pcp.id,
      type: "problem_collections_problem",
      attributes: {
        problem_id: pcp.problem_id,
        position: pcp.position,
        problem_collection_id: pcId,
      },
    });
  }
  return {
    data: {
      id: "1",
      type: "activity",
      attributes: {},
      relationships: {
        problem_collections: { data: pcRelData },
      },
    },
    included: includedItems,
  };
}

describe("manage_problem_collection_problems set", () => {
  it("빈 상태에서 3개 문제 set → 3개 create", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps("pc1", []));
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: ["p1", "p2", "p3"],
    });
    expect(getText(result)).toContain("추가 3");
    expect(getText(result)).toContain("최종 문제 수: 3");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(3);
    expect(payload.data_to_update).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
    expect(payload.data_to_create[0].attributes.problem_id).toBe("p1");
    expect(payload.data_to_create[0].attributes.position).toBe(0);
    expect(payload.data_to_create[2].attributes.position).toBe(2);
  });

  it("기존 3개에서 순서 변경 → position update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
        { id: "pcp3", problem_id: "p3", position: 2 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    // Reverse order
    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: ["p3", "p2", "p1"],
    });
    expect(getText(result)).toContain("순서변경 2");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
    // p3: 2→0, p2: 1→1 (no change), p1: 0→2
    expect(payload.data_to_update).toHaveLength(2);
    const updateIds = payload.data_to_update.map(
      (u: Record<string, unknown>) => u.id,
    );
    expect(updateIds).toContain("pcp1");
    expect(updateIds).toContain("pcp3");
  });

  it("기존 3개에서 1개 제거 + 1개 추가 → create 1 + destroy 1 + update positions", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
        { id: "pcp3", problem_id: "p3", position: 2 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    // Remove p2, add p4, keep p1 and p3
    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: ["p1", "p3", "p4"],
    });
    expect(getText(result)).toContain("추가 1");
    expect(getText(result)).toContain("제거 1");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(1);
    expect(payload.data_to_create[0].attributes.problem_id).toBe("p4");
    expect(payload.data_to_create[0].attributes.position).toBe(2);
    expect(payload.data_to_destroy).toHaveLength(1);
    expect(payload.data_to_destroy[0].id).toBe("pcp2");
    // p1: 0→0 (no change), p3: 2→1 (changed)
    expect(payload.data_to_update).toHaveLength(1);
    expect(payload.data_to_update[0].id).toBe("pcp3");
    expect(payload.data_to_update[0].attributes.position).toBe(1);
  });

  it("PC 없는 활동 → 에러 메시지", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps(null, []));

    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("ProblemCollection이 없습니다");
  });

  it("problem_ids 빈 배열 → 전체 destroy", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: [],
    });
    expect(getText(result)).toContain("제거 2");
    expect(getText(result)).toContain("최종 문제 수: 0");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(0);
    expect(payload.data_to_update).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(2);
  });

  it("변경 사항 없으면 API 호출 안 함", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
      ]),
    );

    const result = await toolHandlers.manage_problem_collection_problems({
      activity_id: "1",
      problem_ids: ["p1", "p2"],
    });
    expect(getText(result)).toContain("변경 사항 없음");
    expect(mockClient.doManyPCP).not.toHaveBeenCalled();
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
    mockClient.updateBoard.mockRejectedValue(new CodleAPIError(422, "Invalid"));

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
