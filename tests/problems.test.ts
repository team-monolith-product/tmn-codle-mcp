import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const MockCodleClient = vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    createProblem: vi.fn(),
    updateProblem: vi.fn(),
    deleteProblem: vi.fn(),
    doManyPCP: vi.fn(),
    doManyProblemAnswers: vi.fn(),
    doManyDescriptiveCriteria: vi.fn(),
  }));
  return { CodleClient: MockCodleClient };
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

const { CodleClient } = await import("../src/api/client.js");
import {
  createProblem,
  updateProblem,
  deleteProblem,
  syncProblemCollection,
} from "../src/services/problem.service.js";

let mockClient: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockClient = new (CodleClient as unknown as new () => Record<
    string,
    ReturnType<typeof vi.fn>
  >)();
});

// ===== createProblem =====

describe("createProblem", () => {
  it("successful create with choices (quiz)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "OX 문제" }),
    );

    const result = await createProblem(mockClient as any, {
      title: "OX 문제",
      problem_type: "quiz",
      choices: [
        { text: "O", isAnswer: true },
        { text: "X", isAnswer: false },
      ],
    });
    expect(result.text).toContain("문제 생성 완료");
    expect(result.text).toContain("10");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.title).toBe("OX 문제");
    expect(payload.data.attributes.problem_type).toBe("quiz");
    expect(payload.data.attributes.blocks).toBeDefined();
  });

  it("successful create with solutions (input)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "11", { title: "주관식" }),
    );

    const result = await createProblem(mockClient as any, {
      title: "주관식",
      problem_type: "quiz",
      solutions: ["42"],
    });
    expect(result.text).toContain("문제 생성 완료");
  });

  it("create descriptive with content converts to blocks", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "12", { title: "서술형" }),
    );

    const result = await createProblem(mockClient as any, {
      title: "서술형",
      problem_type: "descriptive",
      content: "설명을 작성하세요",
    });
    expect(result.text).toContain("문제 생성 완료");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.blocks).toBeDefined();
    expect(payload.data.attributes.blocks.root.type).toBe("root");
    expect(payload.data.attributes.content).toBe("설명을 작성하세요");
  });

  it("create API error propagates", async () => {
    mockClient.createProblem.mockRejectedValue(
      new CodleAPIError(422, "Validation failed"),
    );

    await expect(
      createProblem(mockClient as any, {
        title: "실패",
        problem_type: "quiz",
      }),
    ).rejects.toThrow("Validation failed");
  });
});

// ===== updateProblem =====

describe("updateProblem", () => {
  it("nothing to update", async () => {
    const result = await updateProblem(mockClient as any, {
      problem_id: "10",
    });
    expect(result.text).toContain("수정할 항목이 없습니다");
  });

  it("successful update", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "수정됨" }),
    );

    const result = await updateProblem(mockClient as any, {
      problem_id: "10",
      title: "수정됨",
    });
    expect(result.text).toContain("문제 수정 완료");
  });

  it("sample_answer만 수정 시 early return 안 됨", async () => {
    mockClient.request.mockResolvedValueOnce({
      data: { id: "10", attributes: { title: "기존 제목" } },
    });
    mockClient.request.mockResolvedValueOnce({ data: [] });
    mockClient.doManyProblemAnswers.mockResolvedValue({});

    const result = await updateProblem(mockClient as any, {
      problem_id: "10",
      sample_answer: "print('hello')",
    });
    expect(result.text).toContain("문제 수정 완료");
    expect(result.text).not.toContain("수정할 항목이 없습니다");
  });
});

// ===== deleteProblem =====

describe("deleteProblem", () => {
  it("successful delete", async () => {
    mockClient.deleteProblem.mockResolvedValue({});

    const result = await deleteProblem(mockClient as any, "10");
    expect(result.text).toContain("문제 삭제 완료");
  });

  it("delete API error propagates", async () => {
    mockClient.deleteProblem.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );

    await expect(deleteProblem(mockClient as any, "999")).rejects.toThrow(
      "Not found",
    );
  });
});

// ===== syncProblemCollection =====

function makeActivityWithPcps(
  pcId: string | null,
  pcps: Array<{
    id: string;
    problem_id: string;
    position: number;
    point?: number;
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
        point: pcp.point ?? 1,
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

describe("syncProblemCollection", () => {
  it("빈 상태에서 3개 문제 set → 3개 create", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps("pc1", []));
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await syncProblemCollection(mockClient as any, {
      activity_id: "1",
      problems: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    });
    expect(result.text).toContain("추가 3");
    expect(result.text).toContain("최종 문제 수: 3");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(3);
    expect(payload.data_to_update).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
    expect(payload.data_to_create[0].attributes.problem_id).toBe("p1");
    expect(payload.data_to_create[0].attributes.position).toBe(0);
    expect(payload.data_to_create[0].attributes.point).toBe(1);
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

    const result = await syncProblemCollection(mockClient as any, {
      activity_id: "1",
      problems: [{ id: "p3" }, { id: "p2" }, { id: "p1" }],
    });
    expect(result.text).toContain("변경 2");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
    expect(payload.data_to_update).toHaveLength(2);
  });

  it("PC 없는 활동 → 에러", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps(null, []));

    await expect(
      syncProblemCollection(mockClient as any, {
        activity_id: "1",
        problems: [{ id: "p1" }],
      }),
    ).rejects.toThrow("ProblemCollection이 없습니다");
  });

  it("problem_ids 빈 배열 → 전체 destroy", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await syncProblemCollection(mockClient as any, {
      activity_id: "1",
      problems: [],
    });
    expect(result.text).toContain("제거 2");
    expect(result.text).toContain("최종 문제 수: 0");

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

    const result = await syncProblemCollection(mockClient as any, {
      activity_id: "1",
      problems: [{ id: "p1" }, { id: "p2" }],
    });
    expect(result.text).toContain("변경 사항 없음");
    expect(mockClient.doManyPCP).not.toHaveBeenCalled();
  });

  it("point 지정하여 생성", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps("pc1", []));
    mockClient.doManyPCP.mockResolvedValue({});

    const result = await syncProblemCollection(mockClient as any, {
      activity_id: "1",
      problems: [{ id: "p1", point: 2 }, { id: "p2", point: 0 }, { id: "p3" }],
    });
    expect(result.text).toContain("추가 3");

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create[0].attributes.point).toBe(2);
    expect(payload.data_to_create[1].attributes.point).toBe(0);
    expect(payload.data_to_create[2].attributes.point).toBe(1);
  });
});
