import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse } from "./helpers.js";
import { pascalToSnake } from "../src/api/models.js";

const mockClient = {
  request: vi.fn(),
  getMaterial: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  duplicateActivity: vi.fn(),
  doManyActivityTransitions: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));

import ActivityCreate from "../src/commands/activity/create.js";
import ActivityUpdate from "../src/commands/activity/update.js";
import ActivityDelete from "../src/commands/activity/delete.js";
import ActivityDuplicate from "../src/commands/activity/duplicate.js";
import ActivitySetFlow from "../src/commands/activity/set-flow.js";
import ActivitySetBranch from "../src/commands/activity/set-branch.js";
import { runCommand } from "./run-command.js";

beforeEach(() => {
  vi.clearAllMocks();
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

describe("activity create", () => {
  it("invalid activity_type", async () => {
    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "test",
      "--type",
      "InvalidType",
    ]);
    expect(mockClient.request).not.toHaveBeenCalled();
    expect(mockClient.createActivity).not.toHaveBeenCalled();
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

    const output = await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "테스트",
      "--type",
      "QuizActivity",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("100");
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

    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "깊은활동",
      "--type",
      "HtmlActivity",
      "--depth",
      "2",
    ]);

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

    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "기본활동",
      "--type",
      "HtmlActivity",
    ]);

    const callArgs = mockClient.createActivity.mock.calls[0][0];
    // depth 미지정 → 1 (default) → 0 (0-indexed)
    expect(callArgs.data.attributes.depth).toBe(0);
  });

  it("short activity type (Quiz → QuizActivity)", async () => {
    mockClient.request.mockResolvedValue(
      makeJsonApiResponse("quiz_activity", "99", {}),
    );
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", {
        name: "축약테스트",
        depth: 0,
        material_id: "1",
      }),
    );

    const output = await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "축약테스트",
      "--type",
      "Quiz",
      "--depth",
      "1",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("100");
    expect(mockClient.request).toHaveBeenCalledWith(
      "POST",
      "/api/v1/quiz_activities",
      { json: { data: { type: "quiz_activity", attributes: {} } } },
    );
    const callArgs = mockClient.createActivity.mock.calls[0][0];
    expect(callArgs.data.attributes.activitiable_type).toBe("QuizActivity");
  });

  it("unknown short type rejected", async () => {
    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "test",
      "--type",
      "Unknown",
      "--depth",
      "1",
    ]);
    expect(mockClient.request).not.toHaveBeenCalled();
    expect(mockClient.createActivity).not.toHaveBeenCalled();
  });

  it("passes entry_category to activitiable attributes for EntryActivity", async () => {
    mockClient.request.mockResolvedValue(
      makeJsonApiResponse("entry_activity", "88", { category: "stage" }),
    );
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "101", {
        name: "엔트리스테이지",
        depth: 0,
        material_id: "1",
      }),
    );

    const output = await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "엔트리스테이지",
      "--type",
      "EntryActivity",
      "--entry-category",
      "stage",
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("101");
    expect(mockClient.request).toHaveBeenCalledWith(
      "POST",
      "/api/v1/entry_activities",
      {
        json: {
          data: {
            type: "entry_activity",
            attributes: { category: "stage" },
          },
        },
      },
    );
  });

  it("ignores entry_category for non-EntryActivity types", async () => {
    mockClient.request.mockResolvedValue(
      makeJsonApiResponse("quiz_activity", "99", {}),
    );
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", {
        name: "퀴즈",
        depth: 0,
        material_id: "1",
      }),
    );

    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "퀴즈",
      "--type",
      "QuizActivity",
      "--entry-category",
      "stage",
    ]);

    expect(mockClient.request).toHaveBeenCalledWith(
      "POST",
      "/api/v1/quiz_activities",
      {
        json: { data: { type: "quiz_activity", attributes: {} } },
      },
    );
  });

  it("returns error when entry_category omitted for EntryActivity", async () => {
    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "엔트리기본",
      "--type",
      "EntryActivity",
    ]);

    expect(mockClient.request).not.toHaveBeenCalled();
  });

  it("returns error when entry_category omitted for short Entry type", async () => {
    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "엔트리축약",
      "--type",
      "Entry",
    ]);

    expect(mockClient.request).not.toHaveBeenCalled();
  });

  it("activitiable no id in response", async () => {
    mockClient.request.mockResolvedValue({
      data: { type: "quiz_activity", attributes: {} },
    });

    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "test",
      "--type",
      "QuizActivity",
    ]);
    expect(mockClient.createActivity).not.toHaveBeenCalled();
  });

  it("activitiable API error", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(422, "Validation failed: name is required"),
    );

    await runCommand(ActivityCreate, [
      "--material-id",
      "1",
      "--name",
      "test",
      "--type",
      "HtmlActivity",
    ]);
    expect(mockClient.createActivity).not.toHaveBeenCalled();
  });
});

describe("activity update", () => {
  it("default depth still updates", async () => {
    mockClient.updateActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "1", { name: "test", depth: 0 }),
    );
    const output = await runCommand(ActivityUpdate, ["1", "--depth", "0"]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("1");
  });

  it("update name", async () => {
    mockClient.updateActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "1", { name: "새이름", depth: 0 }),
    );
    const output = await runCommand(ActivityUpdate, ["1", "--name", "새이름"]);
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("새이름");
  });
});

describe("activity delete", () => {
  it("successful delete", async () => {
    mockClient.deleteActivity.mockResolvedValue({});
    const output = await runCommand(ActivityDelete, ["1"]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("1");
    expect(parsed.deleted).toBe(true);
  });

  it("delete API error", async () => {
    mockClient.deleteActivity.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );
    // CodleAPIError is caught by BaseCommand.catch() and converted to this.error()
    // which is an oclif exit error handled by runCommand
    await runCommand(ActivityDelete, ["999"]);
    expect(mockClient.deleteActivity).toHaveBeenCalledWith("999");
  });
});

describe("activity set-branch", () => {
  it("successful branch two levels", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const output = await runCommand(ActivitySetBranch, [
      "--material-id",
      "1",
      "--from",
      "50",
      "--mid",
      "51",
      "--low",
      "52",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.branch_from).toBe("50");
    expect(parsed.levels.mid).toBe("51");
    expect(parsed.levels.low).toBe("52");
    expect(parsed.created).toBe(2);
    expect(parsed.destroyed).toBe(0);

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

    const output = await runCommand(ActivitySetBranch, [
      "--material-id",
      "1",
      "--from",
      "50",
      "--mid",
      "51",
      "--low",
      "52",
      "--high",
      "53",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(3);
    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(3);
  });

  it("only mid fails (needs at least 2)", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });

    await runCommand(ActivitySetBranch, [
      "--material-id",
      "1",
      "--from",
      "50",
      "--mid",
      "51",
    ]);
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

    const output = await runCommand(ActivitySetBranch, [
      "--material-id",
      "1",
      "--from",
      "50",
      "--mid",
      "51",
      "--low",
      "52",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.destroyed).toBe(1);
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

    // CodleAPIError is caught by BaseCommand.catch() and converted to this.error()
    await runCommand(ActivitySetBranch, [
      "--material-id",
      "1",
      "--from",
      "50",
      "--mid",
      "51",
      "--low",
      "52",
    ]);
    expect(mockClient.doManyActivityTransitions).toHaveBeenCalled();
  });
});

describe("activity set-flow", () => {
  it("two activities linked", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const output = await runCommand(ActivitySetFlow, [
      "--material-id",
      "1",
      "--ids",
      "10",
      "--ids",
      "20",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.activity_ids).toEqual(["10", "20"]);
    expect(parsed.created).toBe(1);

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

    const output = await runCommand(ActivitySetFlow, [
      "--material-id",
      "1",
      "--ids",
      "10",
      "--ids",
      "20",
      "--ids",
      "30",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.activity_ids).toEqual(["10", "20", "30"]);

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

    const output = await runCommand(ActivitySetFlow, [
      "--material-id",
      "1",
      "--ids",
      "10",
      "--ids",
      "30",
      "--ids",
      "20",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.destroyed).toBe(2);

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

    await runCommand(ActivitySetFlow, [
      "--material-id",
      "1",
      "--ids",
      "10",
      "--ids",
      "20",
    ]);

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

    // CodleAPIError is caught by BaseCommand.catch() and converted to this.error()
    await runCommand(ActivitySetFlow, [
      "--material-id",
      "1",
      "--ids",
      "10",
      "--ids",
      "20",
    ]);
    expect(mockClient.doManyActivityTransitions).toHaveBeenCalled();
  });
});
