import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodleAPIError } from "../src/api/errors.js";
import { makeJsonApiResponse } from "./helpers.js";

vi.mock("../src/api/client.js", () => {
  const mockClient = {
    ensureAuth: vi.fn(),
    request: vi.fn(),
  };
  return { CodleClient: vi.fn(() => mockClient), _mockClient: mockClient };
});

const { _mockClient } = await import("../src/api/client.js") as any;
const mockClient = _mockClient as Record<
  string,
  ReturnType<typeof vi.fn>
>;

import { manageHtmlActivityPages } from "../src/services/htmlActivityPage.service.js";

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

describe("manageHtmlActivityPages — resolveHtmlActivityId", () => {
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

    await expect(
      manageHtmlActivityPages(mockClient as any, {
        activity_id: "act-1",
        pages: [{ url: "https://example.com" }],
      }),
    ).rejects.toThrow("HtmlActivity만 지원");
  });

  it("Activity 조회 API 에러", async () => {
    mockClient.request.mockRejectedValueOnce(
      new CodleAPIError(404, "Activity not found"),
    );

    await expect(
      manageHtmlActivityPages(mockClient as any, {
        activity_id: "999",
        pages: [{ url: "https://example.com" }],
      }),
    ).rejects.toThrow(CodleAPIError);
  });
});

describe("manageHtmlActivityPages — 페이지 생성", () => {
  it("기존 페이지 없을 때 새 페이지 생성", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockResolvedValueOnce({}); // do_many

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [
        { url: "https://example.com/page1" },
        { url: "https://example.com/page2" },
      ],
    });
    expect(result.text).toContain("교안 페이지 설정 완료");
    expect(result.text).toContain("추가 2");
    expect(result.text).toContain("최종 페이지 수: 2");

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

    await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [{ url: "https://example.com/page1" }],
    });

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

    await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [
        {
          url: "https://example.com/page1",
          progress_calculation_method: "no_calculation",
        },
      ],
    });

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(
      payload.data_to_create[0].attributes.progress_calculation_method,
    ).toBe("no_calculation");
    expect(payload.data_to_create[0].attributes.completion_seconds).toBeNull();
  });
});

describe("manageHtmlActivityPages — 페이지 수정", () => {
  it("URL이 변경된 페이지만 업데이트", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://old.com/page1", position: 0 },
      { id: "p2", url: "https://old.com/page2", position: 1 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [
        { url: "https://old.com/page1" }, // unchanged
        { url: "https://new.com/page2" }, // changed
      ],
    });
    expect(result.text).toContain("변경 1");

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

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [{ url: "https://example.com/page1" }],
    });
    expect(result.text).toContain("변경 사항 없음");
    expect(mockClient.request).toHaveBeenCalledTimes(2);
  });
});

describe("manageHtmlActivityPages — 페이지 삭제", () => {
  it("빈 배열이면 모든 페이지 삭제", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://example.com/page1", position: 0 },
      { id: "p2", url: "https://example.com/page2", position: 1 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [],
    });
    expect(result.text).toContain("제거 2");
    expect(result.text).toContain("최종 페이지 수: 0");

    const payload = mockClient.request.mock.calls[2][2].json;
    expect(payload.data_to_destroy).toHaveLength(2);
  });
});

describe("manageHtmlActivityPages — 복합 동작", () => {
  it("수정 + 삭제 동시 처리", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", [
      { id: "p1", url: "https://old.com/page1", position: 0 },
      { id: "p2", url: "https://old.com/page2", position: 1 },
      { id: "p3", url: "https://old.com/page3", position: 2 },
    ]);
    mockClient.request.mockResolvedValueOnce({});

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [
        { url: "https://old.com/page1" }, // keep p1
        { url: "https://new.com/page2" }, // update p2
        // p3 removed
      ],
    });

    expect(result.text).toContain("변경 1");
    expect(result.text).toContain("제거 1");

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

    const result = await manageHtmlActivityPages(mockClient as any, {
      activity_id: "act-1",
      pages: [
        { url: "https://new.com/page1" }, // update p1
        { url: "https://new.com/page2", width: 800, height: 600 }, // create
      ],
    });

    expect(result.text).toContain("추가 1");
    expect(result.text).toContain("변경 1");

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

describe("manageHtmlActivityPages — do_many 에러", () => {
  it("do_many API 에러 시 throw", async () => {
    mockResolveHtmlActivity("h1");
    mockExistingPages("h1", []);
    mockClient.request.mockRejectedValueOnce(
      new CodleAPIError(422, "Validation failed"),
    );

    await expect(
      manageHtmlActivityPages(mockClient as any, {
        activity_id: "act-1",
        pages: [{ url: "https://example.com" }],
      }),
    ).rejects.toThrow(CodleAPIError);
  });
});
