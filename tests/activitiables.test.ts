import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const MockCodleClient = vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    listBoards: vi.fn(),
    updateBoard: vi.fn(),
    updateSheetActivity: vi.fn(),
    updateEmbeddedActivity: vi.fn(),
  }));
  return { CodleClient: MockCodleClient };
});

const { CodleClient } = await import("../src/api/client.js");
import { updateActivitiable } from "../src/services/activitiable.service.js";

let mockClient: Record<string, ReturnType<typeof vi.fn>>;

function mockResolveActivitiable(type: string, id: string) {
  mockClient.request.mockResolvedValue({
    data: {
      id: "act-1",
      type: "activity",
      attributes: {},
      relationships: {
        activitiable: {
          data: { type, id },
        },
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClient = new (CodleClient as unknown as new () => Record<
    string,
    ReturnType<typeof vi.fn>
  >)();
});

describe("updateActivitiable — resolveActivitiable", () => {
  it("activitiable이 없으면 에러", async () => {
    mockClient.request.mockResolvedValue({
      data: {
        id: "act-1",
        type: "activity",
        attributes: {},
        relationships: {
          activitiable: { data: {} },
        },
      },
    });

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
        content: "test",
      }),
    ).rejects.toThrow("activitiable을 찾을 수 없습니다");
  });

  it("API 에러 시 전파", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(404, "Activity not found"),
    );

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "999",
        content: "test",
      }),
    ).rejects.toThrow("Activity not found");
  });
});

describe("updateActivitiable — BoardActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("board_activity", "b1");
  });

  it("content와 name 모두 없으면 에러", async () => {
    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
      }),
    ).rejects.toThrow("content 또는 name 중 하나 이상 필요");
  });

  it("Board가 없으면 에러", async () => {
    mockClient.listBoards.mockResolvedValue({ data: [] });

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
        content: "안내문",
      }),
    ).rejects.toThrow("연결된 Board가 없습니다");
    expect(mockClient.listBoards).toHaveBeenCalledWith({
      "filter[boardable_type]": "Activity",
      "filter[boardable_id]": "act-1",
    });
  });

  it("content로 보드 업데이트 성공", async () => {
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockResolvedValue(
      makeJsonApiResponse("board", "b1", {}),
    );

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      content: "# 안내문",
    });
    expect(result.text).toContain("보드 업데이트 완료");
    expect(result.text).toContain("b1");

    const payload = mockClient.updateBoard.mock.calls[0][1];
    expect(payload.data.attributes.lexical).toBeDefined();
    expect(payload.data.attributes.lexical.root).toBeDefined();
  });

  it("name으로 보드 업데이트 성공", async () => {
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockResolvedValue(
      makeJsonApiResponse("board", "b1", {}),
    );

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      name: "새 보드 이름",
    });
    expect(result.text).toContain("보드 업데이트 완료");

    const payload = mockClient.updateBoard.mock.calls[0][1];
    expect(payload.data.attributes.name).toBe("새 보드 이름");
    expect(payload.data.attributes.lexical).toBeUndefined();
  });

  it("보드 조회 API 에러 전파", async () => {
    mockClient.listBoards.mockRejectedValue(
      new CodleAPIError(500, "Internal error"),
    );

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
        content: "test",
      }),
    ).rejects.toThrow("Internal error");
  });
});

describe("updateActivitiable — SheetActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("sheet_activity", "s1");
  });

  it("content 없으면 에러", async () => {
    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
      }),
    ).rejects.toThrow("content는 필수");
  });

  it("content로 활동지 설명 업데이트 성공", async () => {
    mockClient.updateSheetActivity.mockResolvedValue(
      makeJsonApiResponse("sheet_activity", "s1", {}),
    );

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      content: "활동지 설명입니다",
    });
    expect(result.text).toContain("활동지 설명 업데이트 완료");
    expect(result.text).toContain("s1");

    const payload = mockClient.updateSheetActivity.mock.calls[0][1];
    expect(payload.data.attributes.description).toBeDefined();
    expect(payload.data.attributes.description.root).toBeDefined();
  });
});

describe("updateActivitiable — EmbeddedActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("embedded_activity", "e1");
  });

  it("url과 goals 모두 없으면 에러", async () => {
    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
      }),
    ).rejects.toThrow("url 또는 goals 중 하나 이상 필요");
  });

  it("url로 업데이트 성공", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      url: "https://example.com",
    });
    expect(result.text).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBe("https://example.com");
  });

  it("goals로 업데이트 성공 (markdown → Lexical 변환)", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      goals: ["목표 1", "목표 2"],
    });
    expect(result.text).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.goals).toHaveLength(2);
    expect(payload.data.attributes.goals[0].root).toBeDefined();
  });
});

describe("updateActivitiable — VideoActivity", () => {
  it("url 없으면 에러", async () => {
    mockResolveActivitiable("video_activity", "v1");

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
      }),
    ).rejects.toThrow("url은 필수");
  });

  it("url로 업데이트 성공", async () => {
    mockClient.request
      .mockResolvedValueOnce({
        data: {
          id: "act-1",
          type: "activity",
          attributes: {},
          relationships: {
            activitiable: {
              data: { type: "video_activity", id: "v1" },
            },
          },
        },
      })
      .mockResolvedValueOnce(makeJsonApiResponse("video_activity", "v1", {}));

    const result = await updateActivitiable(mockClient as any, {
      activity_id: "act-1",
      url: "https://example.com/video",
    });
    expect(result.text).toContain("VideoActivity 업데이트 완료");
    expect(result.text).toContain("v1");

    const putCall = mockClient.request.mock.calls[1];
    expect(putCall[0]).toBe("PUT");
    expect(putCall[1]).toBe("/api/v1/video_activities/v1");
    expect(putCall[2].json.data.attributes.url).toBe(
      "https://example.com/video",
    );
  });
});

describe("updateActivitiable — 지원하지 않는 유형", () => {
  it("QuizActivity 등 미지원 유형은 에러", async () => {
    mockResolveActivitiable("quiz_activity", "q1");

    await expect(
      updateActivitiable(mockClient as any, {
        activity_id: "act-1",
        content: "test",
      }),
    ).rejects.toThrow("지원하지 않는 유형");
  });
});
