import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse } from "./helpers.js";

// We need to mock the client module before importing tools
vi.mock("../src/api/client.js", () => {
  const mockClient = {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    request: vi.fn(),
    getMaterial: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    duplicateActivity: vi.fn(),
    createActivityTransition: vi.fn(),
    doManyActivityTransitions: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

// Import after mocking
const { client } = await import("../src/api/client.js");
const { pascalToSnake } = await import("../src/tools/activities.js");

// We'll test the tool handlers directly via a helper
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActivityTools } from "../src/tools/activities.js";

// Capture the tool handlers
const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
registerActivityTools(mockServer);

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
  (client as Record<string, unknown>).userId = "test-user-123";
});

describe("pascalToSnake", () => {
  it("QuizActivity", () => {
    expect(pascalToSnake("QuizActivity")).toBe("quiz_activity");
  });

  it("HtmlActivity", () => {
    expect(pascalToSnake("HtmlActivity")).toBe("html_activity");
  });

  it("single word", () => {
    expect(pascalToSnake("Activity")).toBe("activity");
  });

  it("AiRecommendQuizActivity", () => {
    expect(pascalToSnake("AiRecommendQuizActivity")).toBe(
      "ai_recommend_quiz_activity",
    );
  });
});

describe("manage_activities create", () => {
  it("missing required params", async () => {
    const result = await toolHandlers.manage_activities({
      action: "create",
      depth: 0,
    });
    expect(getText(result)).toContain("필수");
  });

  it("invalid activity_type", async () => {
    const result = await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "test",
      activity_type: "InvalidType",
      depth: 0,
    });
    expect(getText(result)).toContain("유효하지 않은 activity_type");
  });

  it("successful create", async () => {
    mockClient.request.mockResolvedValue(
      makeJsonApiResponse("quiz_activity", "99", { is_exam: false }),
    );
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", {
        name: "테스트",
        depth: 0,
        material_id: "1",
      }),
    );

    const result = await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "테스트",
      activity_type: "QuizActivity",
      depth: 0,
    });

    expect(getText(result)).toContain("100");
    expect(getText(result)).toContain("생성 완료");
    expect(mockClient.request).toHaveBeenCalledWith(
      "POST",
      "/api/v1/quiz_activities",
      {
        json: { data: { type: "quiz_activity", attributes: {} } },
      },
    );
    const callArgs = mockClient.createActivity.mock.calls[0][0];
    expect(callArgs.data.attributes.activitiable_type).toBe("QuizActivity");
    expect(callArgs.data.attributes.activitiable_id).toBe("99");
    // No auto-chain: getMaterial should not be called
    expect(mockClient.getMaterial).not.toHaveBeenCalled();
  });

  it("depth 1-indexed to 0-indexed conversion", async () => {
    mockClient.request.mockResolvedValue({
      data: { id: "99", type: "html_activity", attributes: {} },
    });
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", { name: "깊은활동", depth: 1 }),
    );

    await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "깊은활동",
      activity_type: "HtmlActivity",
      depth: 2,
    });

    const callArgs = mockClient.createActivity.mock.calls[0][0];
    // depth 2 (1-indexed) → 1 (0-indexed for Rails API)
    expect(callArgs.data.attributes.depth).toBe(1);
  });

  it("depth defaults to 1 when omitted", async () => {
    mockClient.request.mockResolvedValue({
      data: { id: "99", type: "html_activity", attributes: {} },
    });
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", { name: "기본활동", depth: 0 }),
    );

    await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "기본활동",
      activity_type: "HtmlActivity",
    });

    const callArgs = mockClient.createActivity.mock.calls[0][0];
    // depth 미지정 → 1 (default) → 0 (0-indexed)
    expect(callArgs.data.attributes.depth).toBe(0);
  });

  it("activitiable no id in response", async () => {
    mockClient.request.mockResolvedValue({
      data: { type: "quiz_activity", attributes: {} },
    });

    const result = await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "test",
      activity_type: "QuizActivity",
      depth: 0,
    });
    expect(getText(result)).toContain("응답에 id 없음");
  });

  it("activitiable API error", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(422, "Validation failed: name is required"),
    );

    const result = await toolHandlers.manage_activities({
      action: "create",
      material_id: "1",
      name: "test",
      activity_type: "HtmlActivity",
      depth: 0,
    });
    expect(getText(result)).toContain("activitiable(HtmlActivity) 생성 실패");
    expect(getText(result)).toContain("Validation failed");
  });
});

describe("manage_activities update", () => {
  it("missing activity_id", async () => {
    const result = await toolHandlers.manage_activities({
      action: "update",
      depth: 0,
    });
    expect(getText(result)).toContain("activity_id는 필수");
  });

  it("default depth still updates", async () => {
    mockClient.updateActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "1", { name: "test", depth: 0 }),
    );
    const result = await toolHandlers.manage_activities({
      action: "update",
      activity_id: "1",
      depth: 0,
    });
    expect(getText(result)).toContain("수정 완료");
  });

  it("update name", async () => {
    mockClient.updateActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "1", { name: "새이름", depth: 0 }),
    );
    const result = await toolHandlers.manage_activities({
      action: "update",
      activity_id: "1",
      name: "새이름",
      depth: 0,
    });
    expect(getText(result)).toContain("수정 완료");
  });
});

describe("manage_activities delete", () => {
  it("missing activity_id", async () => {
    const result = await toolHandlers.manage_activities({
      action: "delete",
      depth: 0,
    });
    expect(getText(result)).toContain("activity_id는 필수");
  });

  it("successful delete", async () => {
    mockClient.deleteActivity.mockResolvedValue({});
    const result = await toolHandlers.manage_activities({
      action: "delete",
      activity_id: "1",
      depth: 0,
    });
    expect(getText(result)).toContain("삭제 완료");
  });

  it("delete API error", async () => {
    mockClient.deleteActivity.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );
    const result = await toolHandlers.manage_activities({
      action: "delete",
      activity_id: "999",
      depth: 0,
    });
    expect(getText(result)).toContain("삭제 실패");
  });
});

describe("manage_activities invalid action", () => {
  it("invalid action", async () => {
    const result = await toolHandlers.manage_activities({
      action: "invalid",
      depth: 0,
    });
    expect(getText(result)).toContain("유효하지 않은 action");
  });
});

describe("set_activity_branch", () => {
  it("successful branch two levels", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_branch({
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
    });
    expect(getText(result)).toContain("갈림길 설정 완료");
    expect(getText(result)).toContain("mid=51");
    expect(getText(result)).toContain("low=52");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(2);
    expect(callArgs.data_to_destroy).toBeUndefined();
  });

  it("three levels", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_branch({
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
      high_activity_id: "53",
    });
    expect(getText(result)).toContain("갈림길 설정 완료");
    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(3);
  });

  it("only mid fails", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });

    const result = await toolHandlers.set_activity_branch({
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
    });
    expect(getText(result)).toContain("최소 2개");
    expect(mockClient.doManyActivityTransitions).not.toHaveBeenCalled();
  });

  it("existing transitions destroyed", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [
        {
          id: "old-t-1",
          type: "activity_transition",
          attributes: {
            before_activity_id: "50",
            after_activity_id: "60",
          },
        },
        {
          id: "other-t",
          type: "activity_transition",
          attributes: {
            before_activity_id: "99",
            after_activity_id: "100",
          },
        },
      ],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_branch({
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
    });
    expect(getText(result)).toContain("기존 transition 1개 제거");
    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_destroy).toEqual([{ id: "old-t-1" }]);
  });

  it("API error", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockRejectedValue(
      new CodleAPIError(422, "Invalid"),
    );

    const result = await toolHandlers.set_activity_branch({
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
    });
    expect(getText(result)).toContain("갈림길 설정 실패");
  });
});

describe("set_activity_flow", () => {
  it("two activities linked", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_flow({
      material_id: "1",
      activity_ids: ["10", "20"],
    });
    expect(getText(result)).toContain("코스 흐름 설정 완료");
    expect(getText(result)).toContain("10 → 20");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(1);
    expect(callArgs.data_to_create[0].attributes).toEqual({
      before_activity_id: "10",
      after_activity_id: "20",
    });
    expect(callArgs.data_to_destroy).toBeUndefined();
  });

  it("three or more activities linked", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_flow({
      material_id: "1",
      activity_ids: ["10", "20", "30"],
    });
    expect(getText(result)).toContain("10 → 20 → 30");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(2);
    expect(callArgs.data_to_create[0].attributes.before_activity_id).toBe("10");
    expect(callArgs.data_to_create[0].attributes.after_activity_id).toBe("20");
    expect(callArgs.data_to_create[1].attributes.before_activity_id).toBe("20");
    expect(callArgs.data_to_create[1].attributes.after_activity_id).toBe("30");
  });

  it("replaces existing linear transitions", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [
        {
          id: "old-t-1",
          type: "activity_transition",
          attributes: {
            before_activity_id: "10",
            after_activity_id: "20",
          },
        },
        {
          id: "old-t-2",
          type: "activity_transition",
          attributes: {
            before_activity_id: "20",
            after_activity_id: "30",
          },
        },
      ],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await toolHandlers.set_activity_flow({
      material_id: "1",
      activity_ids: ["10", "30", "20"],
    });
    expect(getText(result)).toContain("기존 선형 transition 2개 제거");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_destroy).toEqual([
      { id: "old-t-1" },
      { id: "old-t-2" },
    ]);
    expect(callArgs.data_to_create).toHaveLength(2);
  });

  it("preserves branch transitions (with level)", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [
        {
          id: "linear-t",
          type: "activity_transition",
          attributes: {
            before_activity_id: "10",
            after_activity_id: "20",
          },
        },
        {
          id: "branch-t",
          type: "activity_transition",
          attributes: {
            before_activity_id: "10",
            after_activity_id: "50",
            level: "mid",
          },
        },
      ],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    await toolHandlers.set_activity_flow({
      material_id: "1",
      activity_ids: ["10", "20"],
    });

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    // Only the linear transition should be destroyed
    expect(callArgs.data_to_destroy).toEqual([{ id: "linear-t" }]);
  });

  it("API error", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockRejectedValue(
      new CodleAPIError(422, "Invalid transition"),
    );

    const result = await toolHandlers.set_activity_flow({
      material_id: "1",
      activity_ids: ["10", "20"],
    });
    expect(getText(result)).toContain("코스 흐름 설정 실패");
  });
});
