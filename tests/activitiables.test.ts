import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    request: vi.fn(),
    listBoards: vi.fn(),
    updateBoard: vi.fn(),
    updateSheetActivity: vi.fn(),
    updateEmbeddedActivity: vi.fn(),
  };
  return { client: mockClient, CodleClient: vi.fn() };
});

const { client } = await import("../src/api/client.js");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActivitiableTools } from "../src/tools/activitiables.js";

const toolHandlers: Record<string, Function> = {};
const mockServer = {
  tool: (name: string, _desc: string, _schema: unknown, handler: Function) => {
    toolHandlers[name] = handler;
  },
} as unknown as McpServer;
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
});

describe("update_activitiable — resolveActivitiable", () => {
  it("activitiable이 없으면 에러 메시지 반환", async () => {
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

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "test",
    });
    expect(getText(result)).toContain("activitiable을 찾을 수 없습니다");
  });

  it("API 에러 시 에러 메시지 반환", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(404, "Activity not found"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "999",
      content: "test",
    });
    expect(getText(result)).toContain("Activity 조회 실패");
  });
});

describe("update_activitiable — BoardActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("board_activity", "b1");
  });

  it("content와 name 모두 없으면 에러", async () => {
    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
    });
    expect(getText(result)).toContain("content 또는 name 중 하나 이상 필요");
  });

  it("Board가 없으면 에러", async () => {
    mockClient.listBoards.mockResolvedValue({ data: [] });

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "안내문",
    });
    expect(getText(result)).toContain("연결된 Board가 없습니다");
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

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "# 안내문",
    });
    expect(getText(result)).toContain("보드 업데이트 완료");
    expect(getText(result)).toContain("b1");

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

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      name: "새 보드 이름",
    });
    expect(getText(result)).toContain("보드 업데이트 완료");

    const payload = mockClient.updateBoard.mock.calls[0][1];
    expect(payload.data.attributes.name).toBe("새 보드 이름");
    expect(payload.data.attributes.lexical).toBeUndefined();
  });

  it("보드 조회 API 에러", async () => {
    mockClient.listBoards.mockRejectedValue(
      new CodleAPIError(500, "Internal error"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "test",
    });
    expect(getText(result)).toContain("Board 조회 실패");
  });

  it("보드 업데이트 API 에러", async () => {
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockRejectedValue(
      new CodleAPIError(422, "Validation failed"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "test",
    });
    expect(getText(result)).toContain("보드 업데이트 실패");
  });
});

describe("update_activitiable — SheetActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("sheet_activity", "s1");
  });

  it("content 없으면 에러", async () => {
    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
    });
    expect(getText(result)).toContain("content는 필수");
  });

  it("content로 활동지 설명 업데이트 성공", async () => {
    mockClient.updateSheetActivity.mockResolvedValue(
      makeJsonApiResponse("sheet_activity", "s1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "활동지 설명입니다",
    });
    expect(getText(result)).toContain("활동지 설명 업데이트 완료");
    expect(getText(result)).toContain("s1");

    const payload = mockClient.updateSheetActivity.mock.calls[0][1];
    expect(payload.data.attributes.description).toBeDefined();
    expect(payload.data.attributes.description.root).toBeDefined();
  });

  it("활동지 업데이트 API 에러", async () => {
    mockClient.updateSheetActivity.mockRejectedValue(
      new CodleAPIError(422, "Invalid"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "test",
    });
    expect(getText(result)).toContain("활동지 설명 업데이트 실패");
  });
});

describe("update_activitiable — EmbeddedActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("embedded_activity", "e1");
  });

  it("url과 goals 모두 없으면 에러", async () => {
    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
    });
    expect(getText(result)).toContain("url 또는 goals 중 하나 이상 필요");
  });

  it("url로 업데이트 성공", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      url: "https://example.com",
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBe("https://example.com");
  });

  it("goals로 업데이트 성공 (markdown → Lexical 변환)", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      goals: ["목표 1", "목표 2"],
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 완료");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.goals).toHaveLength(2);
    expect(payload.data.attributes.goals[0].root).toBeDefined();
    expect(payload.data.attributes.goals[1].root).toBeDefined();
  });

  it("EmbeddedActivity 업데이트 API 에러", async () => {
    mockClient.updateEmbeddedActivity.mockRejectedValue(
      new CodleAPIError(422, "Invalid URL"),
    );

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      url: "bad-url",
    });
    expect(getText(result)).toContain("EmbeddedActivity 업데이트 실패");
  });
});

describe("update_activitiable — VideoActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("video_activity", "v1");
  });

  it("url 없으면 에러", async () => {
    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
    });
    expect(getText(result)).toContain("url은 필수");
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

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      url: "https://example.com/video",
    });
    expect(getText(result)).toContain("VideoActivity 업데이트 완료");
    expect(getText(result)).toContain("v1");

    // 두 번째 request 호출이 PUT video_activities
    const putCall = mockClient.request.mock.calls[1];
    expect(putCall[0]).toBe("PUT");
    expect(putCall[1]).toBe("/api/v1/video_activities/v1");
    expect(putCall[2].json.data.attributes.url).toBe(
      "https://example.com/video",
    );
  });

  it("API 에러 처리", async () => {
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
      .mockRejectedValueOnce(new CodleAPIError(422, "Invalid video URL"));

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      url: "bad-url",
    });
    expect(getText(result)).toContain("VideoActivity 업데이트 실패");
  });
});

describe("update_activitiable — 지원하지 않는 유형", () => {
  it("QuizActivity 등 미지원 유형은 에러", async () => {
    mockResolveActivitiable("quiz_activity", "q1");

    const result = await toolHandlers.update_activitiable({
      activity_id: "act-1",
      content: "test",
    });
    expect(getText(result)).toContain("지원하지 않는 유형");
  });
});
