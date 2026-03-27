import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

const mockClient = {
  request: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
  doManyPCP: vi.fn(),
  doManyProblemAnswers: vi.fn(),
  doManyDescriptiveCriteria: vi.fn(),
  listBoards: vi.fn(),
  updateBoard: vi.fn(),
  updateSheetActivity: vi.fn(),
  updateEmbeddedActivity: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));

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

import ProblemCreate from "../src/commands/problem/create.js";
import ProblemUpdate from "../src/commands/problem/update.js";
import ProblemDelete from "../src/commands/problem/delete.js";
import ActivitySetProblems from "../src/commands/activity/set-problems.js";
import ActivitiableUpdate from "../src/commands/activitiable/update.js";
import { runCommand } from "./run-command.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ===== problem create =====

describe("problem create", () => {
  it("successful create with choices (quiz)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "OX 문제" }),
    );

    const output = await runCommand(ProblemCreate, [
      "--title",
      "OX 문제",
      "--type",
      "quiz",
      "--choices",
      JSON.stringify([
        { text: "O", isAnswer: true },
        { text: "X", isAnswer: false },
      ]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("10");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.title).toBe("OX 문제");
    expect(payload.data.attributes.problem_type).toBe("quiz");
    expect(payload.data.attributes.blocks).toBeDefined();
  });

  it("successful create with solutions (input)", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "11", { title: "주관식" }),
    );

    const output = await runCommand(ProblemCreate, [
      "--title",
      "주관식",
      "--type",
      "quiz",
      "--solutions",
      "42",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("11");
  });

  it("create descriptive with content converts to blocks", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "12", { title: "서술형" }),
    );

    const output = await runCommand(ProblemCreate, [
      "--title",
      "서술형",
      "--type",
      "descriptive",
      "--content",
      "설명을 작성하세요",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("12");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.blocks).toBeDefined();
    expect(payload.data.attributes.blocks.root.type).toBe("root");
    expect(payload.data.attributes.content).toBe("설명을 작성하세요");
  });

  it("create sheet with content converts to blocks", async () => {
    mockClient.createProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "13", { title: "활동지" }),
    );

    const output = await runCommand(ProblemCreate, [
      "--title",
      "활동지",
      "--type",
      "sheet",
      "--content",
      "문제 내용",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("13");

    const payload = mockClient.createProblem.mock.calls[0][0];
    expect(payload.data.attributes.blocks).toBeDefined();
    expect(payload.data.attributes.content).toBe("문제 내용");
  });

  it("create API error", async () => {
    mockClient.createProblem.mockRejectedValue(
      new CodleAPIError(422, "Validation failed"),
    );

    await runCommand(ProblemCreate, ["--title", "실패", "--type", "quiz"]);
    expect(mockClient.createProblem).toHaveBeenCalled();
  });

  it("missing required params does not call API", async () => {
    // --title and --type are required by oclif
    await runCommand(ProblemCreate, []);
    expect(mockClient.createProblem).not.toHaveBeenCalled();
  });
});

// ===== problem update =====

describe("problem update", () => {
  it("nothing to update", async () => {
    const output = await runCommand(ProblemUpdate, ["10"]);
    expect(output).toContain("수정할 항목이 없습니다");
  });

  it("successful update", async () => {
    mockClient.updateProblem.mockResolvedValue(
      makeJsonApiResponse("problem", "10", { title: "수정됨" }),
    );

    const output = await runCommand(ProblemUpdate, ["10", "--title", "수정됨"]);
    const parsed = JSON.parse(output);
    expect(parsed.title).toBe("수정됨");
  });

  it("sample_answer만 수정 시 early return 안 됨", async () => {
    mockClient.request.mockResolvedValueOnce({
      data: { id: "10", attributes: { title: "기존 제목" } },
    });
    mockClient.request.mockResolvedValueOnce({ data: [] });
    mockClient.doManyProblemAnswers.mockResolvedValue({});

    const output = await runCommand(ProblemUpdate, [
      "10",
      "--sample-answer",
      "print('hello')",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("10");
    expect(parsed.message).toBeUndefined();
  });

  it("missing id does not call API", async () => {
    await runCommand(ProblemUpdate, ["--title", "수정됨"]);
    expect(mockClient.updateProblem).not.toHaveBeenCalled();
  });
});

// ===== problem delete =====

describe("problem delete", () => {
  it("successful delete", async () => {
    mockClient.deleteProblem.mockResolvedValue({});

    const output = await runCommand(ProblemDelete, ["10"]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("10");
    expect(parsed.deleted).toBe(true);
  });

  it("delete API error", async () => {
    mockClient.deleteProblem.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );

    await runCommand(ProblemDelete, ["999"]);
    expect(mockClient.deleteProblem).toHaveBeenCalled();
  });

  it("missing id does not call API", async () => {
    await runCommand(ProblemDelete, []);
    expect(mockClient.deleteProblem).not.toHaveBeenCalled();
  });
});

// ===== problem collection sync =====

/** Activity 응답을 PC relationship + PCP included で生成 */
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

describe("problem collection sync", () => {
  it("빈 상태에서 3개 문제 set → 3개 create", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps("pc1", []));
    mockClient.doManyPCP.mockResolvedValue({});

    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p1" }, { id: "p2" }, { id: "p3" }]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(3);
    expect(parsed.total).toBe(3);

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create).toHaveLength(3);
    expect(payload.data_to_update).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
    expect(payload.data_to_create[0].attributes.problem_id).toBe("p1");
    expect(payload.data_to_create[0].attributes.position).toBe(0);
    expect(payload.data_to_create[0].attributes.point).toBe(1);
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
    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p3" }, { id: "p2" }, { id: "p1" }]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.updated).toBe(2);

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
    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p1" }, { id: "p3" }, { id: "p4" }]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(1);
    expect(parsed.destroyed).toBe(1);

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

  it("PC 없는 활동 → 에러", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps(null, []));

    await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p1" }]),
    ]);
    expect(mockClient.doManyPCP).not.toHaveBeenCalled();
  });

  it("problem_ids 빈 배열 → 전체 destroy", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0 },
        { id: "pcp2", problem_id: "p2", position: 1 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      "[]",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.destroyed).toBe(2);

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

    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p1" }, { id: "p2" }]),
    ]);
    expect(output).toContain("변경 사항");
    expect(mockClient.doManyPCP).not.toHaveBeenCalled();
  });

  it("point 지정하여 생성", async () => {
    mockClient.request.mockResolvedValue(makeActivityWithPcps("pc1", []));
    mockClient.doManyPCP.mockResolvedValue({});

    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([
        { id: "p1", point: 2 },
        { id: "p2", point: 0 },
        { id: "p3" },
      ]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(3);

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_create[0].attributes.point).toBe(2);
    expect(payload.data_to_create[1].attributes.point).toBe(0);
    expect(payload.data_to_create[2].attributes.point).toBe(1);
  });

  it("기존 point 변경 → update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivityWithPcps("pc1", [
        { id: "pcp1", problem_id: "p1", position: 0, point: 1 },
      ]),
    );
    mockClient.doManyPCP.mockResolvedValue({});

    const output = await runCommand(ActivitySetProblems, [
      "--activity-id",
      "1",
      "--problems",
      JSON.stringify([{ id: "p1", point: 3 }]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.updated).toBe(1);

    const payload = mockClient.doManyPCP.mock.calls[0][0];
    expect(payload.data_to_update[0].attributes.point).toBe(3);
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

    await runCommand(ActivitiableUpdate, ["--activity-id", "1"]);
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
  });

  it("no board found", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ba1", "board_activity"),
    );
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", []),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--content",
      "# Hello",
    ]);
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--content",
      "# 안내문",
      "--name",
      "새 보드",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("b1");

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

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--content",
      "# test",
    ]);
    expect(mockClient.updateBoard).toHaveBeenCalled();
  });
});

describe("update_activitiable — SheetActivity", () => {
  it("no content for sheet", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("sa1", "sheet_activity"),
    );

    await runCommand(ActivitiableUpdate, ["--activity-id", "1"]);
    expect(mockClient.updateSheetActivity).not.toHaveBeenCalled();
  });

  it("successful update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("sa1", "sheet_activity"),
    );
    mockClient.updateSheetActivity.mockResolvedValue(
      makeJsonApiResponse("sheet_activity", "sa1", {}),
    );

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--content",
      "# 활동지 설명",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("sa1");

    const payload = mockClient.updateSheetActivity.mock.calls[0][1];
    expect(payload.data.attributes.description).toBeDefined();
  });

  it("API error on activity fetch", async () => {
    mockClient.request.mockRejectedValue(new CodleAPIError(404, "Not found"));

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "999",
      "--content",
      "# test",
    ]);
    expect(mockClient.updateSheetActivity).not.toHaveBeenCalled();
  });
});

describe("update_activitiable — EmbeddedActivity", () => {
  it("nothing to update", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("ea1", "embedded_activity"),
    );

    await runCommand(ActivitiableUpdate, ["--activity-id", "1"]);
    expect(mockClient.updateEmbeddedActivity).not.toHaveBeenCalled();
  });

  it("no activitiable found", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse(undefined, "embedded_activity"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--url",
      "https://example.com",
    ]);
    expect(mockClient.updateEmbeddedActivity).not.toHaveBeenCalled();
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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--url",
      "https://example.com",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("ea1");

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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--goals",
      "목표1",
      "--goals",
      "목표2",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("ea1");

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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--url",
      "https://codle.io",
      "--goals",
      "학습목표",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("ea1");

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

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--url",
      "bad-url",
    ]);
    expect(mockClient.updateEmbeddedActivity).toHaveBeenCalled();
  });
});

describe("update_activitiable — unsupported type", () => {
  it("returns error for unsupported type", async () => {
    mockClient.request.mockResolvedValue(
      makeActivitiableResponse("qa1", "quiz_activity"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "1",
      "--content",
      "test",
    ]);
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
    expect(mockClient.updateSheetActivity).not.toHaveBeenCalled();
    expect(mockClient.updateEmbeddedActivity).not.toHaveBeenCalled();
  });
});
