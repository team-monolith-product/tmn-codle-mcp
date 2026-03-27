import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse, makeJsonApiListResponse } from "./helpers.js";

const mockClient = {
  request: vi.fn(),
  listBoards: vi.fn(),
  updateBoard: vi.fn(),
  updateSheetActivity: vi.fn(),
  updateEmbeddedActivity: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));

import ActivitiableUpdate from "../src/commands/activitiable/update.js";
import { runCommand } from "./run-command.js";

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

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "test",
    ]);
    // this.error() is called, downstream mocks should not be invoked
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
  });

  it("API 에러 시 에러 처리", async () => {
    mockClient.request.mockRejectedValue(
      new CodleAPIError(404, "Activity not found"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "999",
      "--content",
      "test",
    ]);
    expect(mockClient.listBoards).not.toHaveBeenCalled();
  });
});

describe("update_activitiable — BoardActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("board_activity", "b1");
  });

  it("content와 name 모두 없으면 에러", async () => {
    await runCommand(ActivitiableUpdate, ["--activity-id", "act-1"]);
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
  });

  it("Board가 없으면 에러", async () => {
    mockClient.listBoards.mockResolvedValue({ data: [] });

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "안내문",
    ]);
    expect(mockClient.listBoards).toHaveBeenCalledWith({
      "filter[boardable_type]": "Activity",
      "filter[boardable_id]": "act-1",
    });
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
  });

  it("content로 보드 업데이트 성공", async () => {
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockResolvedValue(
      makeJsonApiResponse("board", "b1", {}),
    );

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "# 안내문",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("b1");

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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--name",
      "새 보드 이름",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("b1");

    const payload = mockClient.updateBoard.mock.calls[0][1];
    expect(payload.data.attributes.name).toBe("새 보드 이름");
    expect(payload.data.attributes.lexical).toBeUndefined();
  });

  it("보드 조회 API 에러", async () => {
    mockClient.listBoards.mockRejectedValue(
      new CodleAPIError(500, "Internal error"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "test",
    ]);
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
  });

  it("보드 업데이트 API 에러", async () => {
    mockClient.listBoards.mockResolvedValue(
      makeJsonApiListResponse("board", [{ id: "b1" }]),
    );
    mockClient.updateBoard.mockRejectedValue(
      new CodleAPIError(422, "Validation failed"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "test",
    ]);
    // The error is caught by BaseCommand.catch()
    expect(mockClient.updateBoard).toHaveBeenCalled();
  });
});

describe("update_activitiable — SheetActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("sheet_activity", "s1");
  });

  it("content 없으면 에러", async () => {
    await runCommand(ActivitiableUpdate, ["--activity-id", "act-1"]);
    expect(mockClient.updateSheetActivity).not.toHaveBeenCalled();
  });

  it("content로 활동지 설명 업데이트 성공", async () => {
    mockClient.updateSheetActivity.mockResolvedValue(
      makeJsonApiResponse("sheet_activity", "s1", {}),
    );

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "활동지 설명입니다",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("s1");

    const payload = mockClient.updateSheetActivity.mock.calls[0][1];
    expect(payload.data.attributes.description).toBeDefined();
    expect(payload.data.attributes.description.root).toBeDefined();
  });

  it("활동지 업데이트 API 에러", async () => {
    mockClient.updateSheetActivity.mockRejectedValue(
      new CodleAPIError(422, "Invalid"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "test",
    ]);
    expect(mockClient.updateSheetActivity).toHaveBeenCalled();
  });
});

describe("update_activitiable — EmbeddedActivity", () => {
  beforeEach(() => {
    mockResolveActivitiable("embedded_activity", "e1");
  });

  it("url과 goals 모두 없으면 에러", async () => {
    await runCommand(ActivitiableUpdate, ["--activity-id", "act-1"]);
    expect(mockClient.updateEmbeddedActivity).not.toHaveBeenCalled();
  });

  it("url로 업데이트 성공", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--url",
      "https://example.com",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("e1");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.url).toBe("https://example.com");
  });

  it("goals로 업데이트 성공 (markdown → Lexical 변환)", async () => {
    mockClient.updateEmbeddedActivity.mockResolvedValue(
      makeJsonApiResponse("embedded_activity", "e1", {}),
    );

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--goals",
      "목표 1",
      "--goals",
      "목표 2",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("e1");

    const payload = mockClient.updateEmbeddedActivity.mock.calls[0][1];
    expect(payload.data.attributes.goals).toHaveLength(2);
    expect(payload.data.attributes.goals[0].root).toBeDefined();
    expect(payload.data.attributes.goals[1].root).toBeDefined();
  });

  it("EmbeddedActivity 업데이트 API 에러", async () => {
    mockClient.updateEmbeddedActivity.mockRejectedValue(
      new CodleAPIError(422, "Invalid URL"),
    );

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--url",
      "bad-url",
    ]);
    expect(mockClient.updateEmbeddedActivity).toHaveBeenCalled();
  });
});

describe("update_activitiable — VideoActivity", () => {
  it("url 없으면 에러", async () => {
    mockResolveActivitiable("video_activity", "v1");

    await runCommand(ActivitiableUpdate, ["--activity-id", "act-1"]);
    // Only the resolve request should have been called, no PUT
    expect(mockClient.request).toHaveBeenCalledTimes(1);
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

    const output = await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--url",
      "https://example.com/video",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("v1");
    expect(parsed.activity_id).toBe("act-1");

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

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--url",
      "bad-url",
    ]);
    // The error is caught by BaseCommand.catch()
    expect(mockClient.request).toHaveBeenCalledTimes(2);
  });
});

describe("update_activitiable — 지원하지 않는 유형", () => {
  it("QuizActivity 등 미지원 유형은 에러", async () => {
    mockResolveActivitiable("quiz_activity", "q1");

    await runCommand(ActivitiableUpdate, [
      "--activity-id",
      "act-1",
      "--content",
      "test",
    ]);
    expect(mockClient.listBoards).not.toHaveBeenCalled();
    expect(mockClient.updateBoard).not.toHaveBeenCalled();
    expect(mockClient.updateSheetActivity).not.toHaveBeenCalled();
    expect(mockClient.updateEmbeddedActivity).not.toHaveBeenCalled();
  });
});
