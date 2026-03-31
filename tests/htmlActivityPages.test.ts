import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse } from "./helpers.js";

const mockClient = {
  request: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));
vi.mock("../src/auth/token-manager.js", () => ({
  load: () => ({
    access_token: "test-token",
    auth_server_url: "",
    client_id: "",
    refresh_token: "",
    scope: "public",
    created_at: 0,
    expires_in: 99999,
  }),
}));

import HtmlActivityPageSync from "../src/commands/html-activity-page/sync.js";
import { runCommand } from "./run-command.js";

function mockResolveHtmlActivity(htmlActivityId: string) {
  mockClient.request.mockResolvedValueOnce({
    data: {
      id: "act-1",
      type: "activity",
      attributes: {},
      relationships: {
        activitiable: {
          data: { type: "html_activity", id: htmlActivityId },
        },
      },
    },
  });
}

function mockExistingPages(
  htmlActivityId: string,
  pages: Array<{
    id: string;
    url: string;
    position: number;
    width?: number;
    height?: number;
    progress_calculation_method?: string;
    completion_seconds?: number;
  }>,
) {
  const included = pages.map((p) => ({
    type: "html_activity_page",
    id: p.id,
    attributes: {
      url: p.url,
      position: p.position,
      width: p.width ?? null,
      height: p.height ?? null,
      progress_calculation_method: p.progress_calculation_method ?? "time",
      completion_seconds: p.completion_seconds ?? 3,
    },
  }));

  mockClient.request.mockResolvedValueOnce(
    makeJsonApiResponse(
      "html_activity",
      htmlActivityId,
      {},
      undefined,
      included,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("html-activity-page sync — resolveHtmlActivityId", () => {
  it("HtmlActivity가 아니면 에러", async () => {
    mockClient.request.mockResolvedValueOnce({
      data: {
        id: "act-1",
        type: "activity",
        attributes: {},
        relationships: {
          activitiable: {
            data: { type: "quiz_activity", id: "q1" },
          },
        },
      },
    });

    await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([{ url: "https://example.com" }]),
    ]);
    // Only the resolve request should have been made, no pages query
    expect(mockClient.request).toHaveBeenCalledTimes(1);
  });

  it("Activity 조회 API 에러", async () => {
    mockClient.request.mockRejectedValueOnce(
      new CodleAPIError(404, "Activity not found"),
    );

    await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "999",
      "--pages",
      JSON.stringify([{ url: "https://example.com" }]),
    ]);
    expect(mockClient.request).toHaveBeenCalledTimes(1);
  });
});

describe("html-activity-page sync — 페이지 생성", () => {
  it("기존 페이지 없을 때 새 페이지 생성", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockResolvedValueOnce({}); // do_many

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([
        { url: "https://example.com/page1" },
        { url: "https://example.com/page2" },
      ]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(2);
    expect(parsed.total).toBe(2);

    // do_many 호출 확인
    const doManyCall = mockClient.request.mock.calls[2];
    expect(doManyCall[0]).toBe("POST");
    expect(doManyCall[1]).toBe("/api/v1/html_activity_pages/do_many");
    const payload = doManyCall[2].json;
    expect(payload.data_to_create).toHaveLength(2);
    expect(payload.data_to_create[0].attributes.url).toBe(
      "https://example.com/page1",
    );
    expect(payload.data_to_create[0].attributes.position).toBe(0);
    expect(payload.data_to_create[0].attributes.html_activity_id).toBe("h1");
    expect(payload.data_to_create[1].attributes.position).toBe(1);
    expect(payload.data_to_update).toHaveLength(0);
    expect(payload.data_to_destroy).toHaveLength(0);
  });

  it("progress_calculation_method 기본값은 time, completion_seconds 기본값은 3", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockResolvedValueOnce({});

    await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([{ url: "https://example.com/page1" }]),
    ]);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(
      payload.data_to_create[0].attributes.progress_calculation_method,
    ).toBe("time");
    expect(payload.data_to_create[0].attributes.completion_seconds).toBe(3);
  });

  it("progress_calculation_method가 no_calculation이면 completion_seconds는 null", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockResolvedValueOnce({});

    await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([
        {
          url: "https://example.com/page1",
          progress_calculation_method: "no_calculation",
        },
      ]),
    ]);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(
      payload.data_to_create[0].attributes.progress_calculation_method,
    ).toBe("no_calculation");
    expect(
      payload.data_to_create[0].attributes.completion_seconds,
    ).toBeUndefined();
  });
});

describe("html-activity-page sync — 페이지 수정", () => {
  it("URL이 변경된 페이지만 업데이트", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://old.com/page1", position: 0 },
      { id: "p2", url: "https://old.com/page2", position: 1 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([
        { url: "https://old.com/page1" }, // unchanged
        { url: "https://new.com/page2" }, // changed
      ]),
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.updated).toBe(1);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(payload.data_to_create).toHaveLength(0);
    expect(payload.data_to_update).toHaveLength(1);
    expect(payload.data_to_update[0].id).toBe("p2");
    expect(payload.data_to_update[0].attributes.url).toBe(
      "https://new.com/page2",
    );
    expect(payload.data_to_destroy).toHaveLength(0);
  });

  it("변경 없으면 API 호출하지 않음", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://example.com/page1", position: 0 },
    ]);

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([{ url: "https://example.com/page1" }]),
    ]);
    expect(output).toContain("변경 사항");
    // do_many는 호출되지 않아야 함 (총 2번만 호출: resolve + getExisting)
    expect(mockClient.request).toHaveBeenCalledTimes(2);
  });
});

describe("html-activity-page sync — 페이지 삭제", () => {
  it("빈 배열이면 모든 페이지 삭제", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://example.com/page1", position: 0 },
      { id: "p2", url: "https://example.com/page2", position: 1 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      "[]",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.destroyed).toBe(2);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(payload.data_to_destroy).toHaveLength(2);
  });
});

describe("html-activity-page sync — 복합 동작", () => {
  it("수정 + 삭제 동시 처리", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://old.com/page1", position: 0 },
      { id: "p2", url: "https://old.com/page2", position: 1 },
      { id: "p3", url: "https://old.com/page3", position: 2 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([
        { url: "https://old.com/page1" }, // keep p1
        { url: "https://new.com/page2" }, // update p2
        // p3 removed
      ]),
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.updated).toBe(1);
    expect(parsed.destroyed).toBe(1);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(payload.data_to_create).toHaveLength(0);
    expect(payload.data_to_update).toHaveLength(1);
    expect(payload.data_to_update[0].id).toBe("p2");
    expect(payload.data_to_update[0].attributes.url).toBe(
      "https://new.com/page2",
    );
    expect(payload.data_to_destroy).toHaveLength(1);
    expect(payload.data_to_destroy[0].id).toBe("p3");
  });

  it("추가 + 수정 동시 처리", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://old.com/page1", position: 0 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const output = await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([
        { url: "https://new.com/page1" }, // update p1
        { url: "https://new.com/page2", width: 800, height: 600 }, // create
      ]),
    ]);

    const parsed = JSON.parse(output);
    expect(parsed.created).toBe(1);
    expect(parsed.updated).toBe(1);

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(payload.data_to_update).toHaveLength(1);
    expect(payload.data_to_update[0].id).toBe("p1");
    expect(payload.data_to_create).toHaveLength(1);
    expect(payload.data_to_create[0].attributes.url).toBe(
      "https://new.com/page2",
    );
    expect(payload.data_to_create[0].attributes.width).toBe(800);
    expect(payload.data_to_create[0].attributes.height).toBe(600);
    expect(payload.data_to_create[0].attributes.position).toBe(1);
    expect(payload.data_to_destroy).toHaveLength(0);
  });
});

describe("html-activity-page sync — do_many 에러", () => {
  it("do_many API 에러 시 에러 처리", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockRejectedValueOnce(
      new CodleAPIError(422, "Validation failed"),
    );

    await runCommand(HtmlActivityPageSync, [
      "--activity-id",
      "act-1",
      "--pages",
      JSON.stringify([{ url: "https://example.com" }]),
    ]);
    // The third request (do_many) was attempted and failed
    expect(mockClient.request).toHaveBeenCalledTimes(3);
  });
});
