import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    listProblems: vi.fn(),
    createProblem: vi.fn(),
    updateProblem: vi.fn(),
    getActivity: vi.fn(),
    doManyProblemCollectionsProblems: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

const { client } = await import("../src/api/client.js");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProblemTools } from "../src/tools/problems.js";

const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
registerProblemTools(mockServer);

const mockClient = client as unknown as Record<string, ReturnType<typeof vi.fn>>;

function getText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0].text;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- upsert_problem ---

describe("upsert_problem create", () => {
  it("successful create", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1", problem_type: "quiz" })
    );

    const result = await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      blocks: { root: { children: [] } },
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("생성 완료");
    expect(getText(result)).toContain("Q1");

    const callArgs = mockClient.createProblem.mock.calls[0][0];
    expect(callArgs.data.attributes.problem_type).toBe("quiz");
  });

  it("invalid problem_type", async () => {
    const result = await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "invalid",
      blocks: {},
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("유효하지 않은 problem_type");
  });

  it("slash in title", async () => {
    const result = await toolHandlers.upsert_problem({
      title: "[O/X] 문제",
      problem_type: "quiz",
      blocks: {},
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("/");
    expect(getText(result)).toContain("사용할 수 없습니다");
  });

  it("blocks required on create", async () => {
    const result = await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("blocks는 필수");
  });

  it("blocks optional on update", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1 수정" })
    );
    const result = await toolHandlers.upsert_problem({
      title: "Q1 수정",
      problem_type: "quiz",
      problem_id: "1",
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("수정 완료");
  });
});

describe("upsert_problem update", () => {
  it("successful update", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", {
        title: "Q1 수정",
        problem_type: "quiz",
      })
    );

    const result = await toolHandlers.upsert_problem({
      title: "Q1 수정",
      problem_type: "quiz",
      problem_id: "1",
      blocks: { root: { children: [] } },
      is_public: false,
      timeout: 1,
    });
    expect(getText(result)).toContain("수정 완료");

    const callArgs = mockClient.updateProblem.mock.calls[0][1];
    expect(callArgs.data.attributes.problem_type).toBeUndefined();
  });

  it("update includes is_public and timeout", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1" })
    );

    await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      problem_id: "1",
      is_public: false,
      timeout: 1,
    });
    const callArgs = mockClient.updateProblem.mock.calls[0][1];
    const attrs = callArgs.data.attributes;
    expect(attrs.is_public).toBe(false);
    expect(attrs.timeout).toBe(1);
  });
});

describe("upsert_problem commentary", () => {
  it("commentary dict", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1" })
    );
    const commentary = { root: { children: [{ text: "해설" }] } };
    await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      blocks: { root: {} },
      commentary,
      is_public: false,
      timeout: 1,
    });
    const callArgs = mockClient.createProblem.mock.calls[0][0];
    expect(callArgs.data.attributes.commentary).toEqual(commentary);
  });

  it("commentary JSON string", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1" })
    );
    const commentaryDict = { root: { children: [] } };
    await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      blocks: { root: {} },
      commentary: JSON.stringify(commentaryDict),
      is_public: false,
      timeout: 1,
    });
    const callArgs = mockClient.createProblem.mock.calls[0][0];
    expect(callArgs.data.attributes.commentary).toEqual(commentaryDict);
  });

  it("commentary invalid string", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "1", { title: "Q1" })
    );
    await toolHandlers.upsert_problem({
      title: "Q1",
      problem_type: "quiz",
      blocks: { root: {} },
      commentary: "just a string",
      is_public: false,
      timeout: 1,
    });
    const callArgs = mockClient.createProblem.mock.calls[0][0];
    expect(callArgs.data.attributes.commentary).toBe("just a string");
  });
});

// --- search_problems ---

describe("search_problems", () => {
  it("basic search", async () => {
    mockClient.listProblems.mockResolvedValue(
      makeJsonApiListResponse("problem", [
        { id: "1", title: "Q1", problem_type: "quiz" },
      ])
    );

    const result = await toolHandlers.search_problems({
      query: "Q1",
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("Q1");
    const callParams = mockClient.listProblems.mock.calls[0][0];
    expect(callParams["filter[query]"]).toBe("Q1");
    expect(callParams["filter[is_exam]"]).toBe("false");
  });

  it("empty results", async () => {
    mockClient.listProblems.mockResolvedValue({ data: [] });
    const result = await toolHandlers.search_problems({
      page_size: 20,
      page_number: 1,
    });
    expect(getText(result)).toContain("검색 결과가 없습니다");
  });
});

// --- manage_problem_collections ---

function activityWithPc(activityId = "100", pcId = "pc-1") {
  return {
    data: {
      type: "activity",
      id: activityId,
      attributes: { name: "퀴즈 활동" },
      relationships: {
        problem_collections: {
          data: [{ type: "problem_collection", id: pcId }],
        },
      },
    },
  };
}

function activityWithoutPc(activityId = "100") {
  return {
    data: {
      type: "activity",
      id: activityId,
      attributes: { name: "영상 활동" },
      relationships: {
        problem_collections: { data: [] },
      },
    },
  };
}

describe("manage_problem_collections create", () => {
  it("successful create", async () => {
    mockClient.getActivity.mockResolvedValue(activityWithPc("100", "pc-1"));
    mockClient.doManyProblemCollectionsProblems.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "100",
      problem_ids: ["p1", "p2"],
    });
    expect(getText(result)).toContain("생성 및 문제 연결 완료");
    expect(getText(result)).toContain("문제 2개");
    expect(getText(result)).toContain("pc-1");

    const callArgs = mockClient.getActivity.mock.calls[0];
    expect(callArgs[0]).toBe("100");
    expect(callArgs[1].include).toBe("problem_collections.pcps");

    const doManyPayload =
      mockClient.doManyProblemCollectionsProblems.mock.calls[0][0];
    expect(doManyPayload.data_to_create).toHaveLength(2);
    expect(doManyPayload.data_to_create[0].attributes.problem_collection_id).toBe("pc-1");
    expect(doManyPayload.data_to_create[0].attributes.problem_id).toBe("p1");
    expect(doManyPayload.data_to_create[0].attributes.position).toBe(0);
    expect(doManyPayload.data_to_create[0].attributes.point).toBe(1);
    expect(doManyPayload.data_to_create[0].attributes.is_required).toBe(true);
    expect(doManyPayload.data_to_create[1].attributes.problem_id).toBe("p2");
    expect(doManyPayload.data_to_create[1].attributes.position).toBe(1);
  });

  it("missing activity_id", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("activity_id는 필수");
  });

  it("missing problem_ids", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "1",
    });
    expect(getText(result)).toContain("problem_ids는 필수");
  });

  it("no problem_collection", async () => {
    mockClient.getActivity.mockResolvedValue(activityWithoutPc("100"));

    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "100",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("ProblemCollection이 없습니다");
  });

  it("activity fetch failure", async () => {
    mockClient.getActivity.mockRejectedValue(
      new CodleAPIError(404, "Not found")
    );

    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "999",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("활동 조회 실패");
  });

  it("link failure partial success", async () => {
    mockClient.getActivity.mockResolvedValue(activityWithPc("100", "pc-1"));
    mockClient.doManyProblemCollectionsProblems.mockRejectedValue(
      new CodleAPIError(422, "Link failed")
    );

    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "100",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("pc-1");
    expect(getText(result)).toContain("문제 연결 실패");
    expect(getText(result)).toContain("add_problems");
  });

  it("single pc object", async () => {
    const resp = {
      data: {
        type: "activity",
        id: "100",
        attributes: {},
        relationships: {
          problem_collections: {
            data: { type: "problem_collection", id: "pc-single" },
          },
        },
      },
    };
    mockClient.getActivity.mockResolvedValue(resp);
    mockClient.doManyProblemCollectionsProblems.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collections({
      action: "create",
      activity_id: "100",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("pc-single");
    expect(getText(result)).toContain("생성 및 문제 연결 완료");
  });
});

describe("manage_problem_collections add_problems", () => {
  it("successful add", async () => {
    mockClient.doManyProblemCollectionsProblems.mockResolvedValue({});

    const result = await toolHandlers.manage_problem_collections({
      action: "add_problems",
      problem_collection_id: "pc-1",
      problem_ids: ["p1", "p2"],
    });
    expect(getText(result)).toContain("문제 연결 완료");
    expect(getText(result)).toContain("문제 2개");
  });

  it("missing pc_id", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "add_problems",
      problem_ids: ["p1"],
    });
    expect(getText(result)).toContain("problem_collection_id는 필수");
  });

  it("missing problem_ids", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "add_problems",
      problem_collection_id: "pc-1",
    });
    expect(getText(result)).toContain("problem_ids는 필수");
  });
});

describe("manage_problem_collections invalid action", () => {
  it("invalid action", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "invalid",
    });
    expect(getText(result)).toContain("유효하지 않은 action");
  });

  it("delete is invalid", async () => {
    const result = await toolHandlers.manage_problem_collections({
      action: "delete",
    });
    expect(getText(result)).toContain("유효하지 않은 action");
  });
});
