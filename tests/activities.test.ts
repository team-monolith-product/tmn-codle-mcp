import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const MockCodleClient = vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    getMaterial: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    duplicateActivity: vi.fn(),
    doManyActivityTransitions: vi.fn(),
  }));
  return { CodleClient: MockCodleClient };
});

const { CodleClient } = await import("../src/api/client.js");
import {
  pascalToSnake,
  createActivity,
  updateActivity,
  deleteActivity,
  duplicateActivity,
  setActivityFlow,
  setActivityBranch,
} from "../src/services/activity.service.js";

let mockClient: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockClient = new (CodleClient as unknown as new () => Record<
    string,
    ReturnType<typeof vi.fn>
  >)();
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

describe("createActivity", () => {
  it("invalid activity_type throws", async () => {
    await expect(
      createActivity(mockClient as any, {
        material_id: "1",
        name: "test",
        activity_type: "InvalidType",
      }),
    ).rejects.toThrow("유효하지 않은 activity_type");
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

    const result = await createActivity(mockClient as any, {
      material_id: "1",
      name: "테스트",
      activity_type: "QuizActivity",
    });

    expect(result.text).toContain("100");
    expect(result.text).toContain("생성 완료");
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
  });

  it("depth 1-indexed to 0-indexed conversion", async () => {
    mockClient.request.mockResolvedValue({
      data: { id: "99", type: "html_activity", attributes: {} },
    });
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", { name: "깊은활동", depth: 1 }),
    );

    await createActivity(mockClient as any, {
      material_id: "1",
      name: "깊은활동",
      activity_type: "HtmlActivity",
      depth: 2,
    });

    const callArgs = mockClient.createActivity.mock.calls[0][0];
    expect(callArgs.data.attributes.depth).toBe(1);
  });

  it("depth defaults to 1 when omitted", async () => {
    mockClient.request.mockResolvedValue({
      data: { id: "99", type: "html_activity", attributes: {} },
    });
    mockClient.createActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "100", { name: "기본활동", depth: 0 }),
    );

    await createActivity(mockClient as any, {
      material_id: "1",
      name: "기본활동",
      activity_type: "HtmlActivity",
    });

    const callArgs = mockClient.createActivity.mock.calls[0][0];
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

    const result = await createActivity(mockClient as any, {
      material_id: "1",
      name: "축약테스트",
      activity_type: "Quiz",
      depth: 1,
    });

    expect(result.text).toContain("생성 완료");
    expect(mockClient.request).toHaveBeenCalledWith(
      "POST",
      "/api/v1/quiz_activities",
      { json: { data: { type: "quiz_activity", attributes: {} } } },
    );
    const callArgs = mockClient.createActivity.mock.calls[0][0];
    expect(callArgs.data.attributes.activitiable_type).toBe("QuizActivity");
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

    const result = await createActivity(mockClient as any, {
      material_id: "1",
      name: "엔트리스테이지",
      activity_type: "EntryActivity",
      entry_category: "stage",
    });

    expect(result.text).toContain("생성 완료");
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

  it("returns error when entry_category omitted for EntryActivity", async () => {
    await expect(
      createActivity(mockClient as any, {
        material_id: "1",
        name: "엔트리기본",
        activity_type: "EntryActivity",
      }),
    ).rejects.toThrow("entry_category");
    expect(mockClient.request).not.toHaveBeenCalled();
  });

  it("activitiable no id in response throws", async () => {
    mockClient.request.mockResolvedValue({
      data: { type: "quiz_activity", attributes: {} },
    });

    await expect(
      createActivity(mockClient as any, {
        material_id: "1",
        name: "test",
        activity_type: "QuizActivity",
      }),
    ).rejects.toThrow("응답에 id 없음");
  });

  it("activitiable API error propagates", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(422, "Validation failed: name is required"),
    );

    await expect(
      createActivity(mockClient as any, {
        material_id: "1",
        name: "test",
        activity_type: "HtmlActivity",
      }),
    ).rejects.toThrow("Validation failed");
  });
});

describe("updateActivity", () => {
  it("update name", async () => {
    mockClient.updateActivity.mockResolvedValue(
      makeJsonApiResponse("activity", "1", { name: "새이름", depth: 0 }),
    );
    const result = await updateActivity(mockClient as any, {
      activity_id: "1",
      name: "새이름",
    });
    expect(result.text).toContain("수정 완료");
  });

  it("no changes", async () => {
    const result = await updateActivity(mockClient as any, {
      activity_id: "1",
    });
    expect(result.text).toContain("수정할 항목이 없습니다");
  });
});

describe("deleteActivity", () => {
  it("successful delete", async () => {
    mockClient.deleteActivity.mockResolvedValue({});
    const result = await deleteActivity(mockClient as any, "1");
    expect(result.text).toContain("삭제 완료");
  });

  it("delete API error propagates", async () => {
    mockClient.deleteActivity.mockRejectedValue(
      new CodleAPIError(404, "Not found"),
    );
    await expect(deleteActivity(mockClient as any, "999")).rejects.toThrow(
      "Not found",
    );
  });
});

describe("setActivityBranch", () => {
  it("successful branch two levels", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await setActivityBranch(mockClient as any, {
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
    });
    expect(result.text).toContain("갈림길 설정 완료");
    expect(result.text).toContain("mid=51");
    expect(result.text).toContain("low=52");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(2);
  });

  it("only mid fails", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });

    await expect(
      setActivityBranch(mockClient as any, {
        material_id: "1",
        branch_from: "50",
        mid_activity_id: "51",
      }),
    ).rejects.toThrow("최소 2개");
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

    const result = await setActivityBranch(mockClient as any, {
      material_id: "1",
      branch_from: "50",
      mid_activity_id: "51",
      low_activity_id: "52",
    });
    expect(result.text).toContain("기존 transition 1개 제거");
    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_destroy).toEqual([{ id: "old-t-1" }]);
  });
});

describe("setActivityFlow", () => {
  it("two activities linked", async () => {
    mockClient.getMaterial.mockResolvedValue({
      data: { id: "1", type: "material", attributes: {} },
      included: [],
    });
    mockClient.doManyActivityTransitions.mockResolvedValue({});

    const result = await setActivityFlow(mockClient as any, {
      material_id: "1",
      activity_ids: ["10", "20"],
    });
    expect(result.text).toContain("코스 흐름 설정 완료");
    expect(result.text).toContain("10 → 20");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_create).toHaveLength(1);
    expect(callArgs.data_to_create[0].attributes).toEqual({
      before_activity_id: "10",
      after_activity_id: "20",
    });
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

    const result = await setActivityFlow(mockClient as any, {
      material_id: "1",
      activity_ids: ["10", "30", "20"],
    });
    expect(result.text).toContain("기존 선형 transition 2개 제거");

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_destroy).toEqual([
      { id: "old-t-1" },
      { id: "old-t-2" },
    ]);
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

    await setActivityFlow(mockClient as any, {
      material_id: "1",
      activity_ids: ["10", "20"],
    });

    const callArgs = mockClient.doManyActivityTransitions.mock.calls[0][0];
    expect(callArgs.data_to_destroy).toEqual([{ id: "linear-t" }]);
  });
});
