import { describe, expect, test } from "../fixtures/claude.js";
import { createMaterial } from "../lib/factory.js";
import { extractText, findToolResult } from "../lib/ndjson.js";

describe("manage_html_activity_pages", () => {
  test("교안 활동에 페이지 추가", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const htmlActivitiable = await factory.create("html_activity");
    const activity = await factory.create("activity", {
      name: "E2E Html Activity",
      materialId: material.id,
      activitiableType: "HtmlActivity",
      activitiableId: htmlActivitiable.id,
    });

    const result = await claude.run(
      `교안 활동 ID "${activity.id}"에 페이지를 설정해줘. ` +
        `첫 번째 페이지 URL은 "https://example.com/page1"이고, ` +
        `두 번째 페이지 URL은 "https://example.com/page2"야.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain(
      "mcp__codle__manage_html_activity_pages",
    );

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_html_activity_pages",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/교안 페이지 설정 완료/);
    expect(text).toMatch(/추가 2/);
  });

  test("진행도 측정 방식 기본값은 time, completion_seconds는 3", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);
    const htmlActivitiable = await factory.create("html_activity");
    const activity = await factory.create("activity", {
      name: "E2E Html Progress Default",
      materialId: material.id,
      activitiableType: "HtmlActivity",
      activitiableId: htmlActivitiable.id,
    });

    const result = await claude.run(
      `교안 활동 ID "${activity.id}"에 페이지를 설정해줘. ` +
        `URL은 "https://example.com/time-page"야.`,
    );

    expect(result.errors).toHaveLength(0);

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_html_activity_pages",
    );
    expect(interaction!.result!.isError).toBe(false);

    const input = interaction!.call.input;
    const page = (input.pages as Array<Record<string, unknown>>)[0];
    expect(page.progress_calculation_method ?? "time").toBe("time");
    expect(page.completion_seconds ?? 3).toBe(3);
  });

  test("no_calculation 지정 시 completion_seconds 없이 전달", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);
    const htmlActivitiable = await factory.create("html_activity");
    const activity = await factory.create("activity", {
      name: "E2E Html No Calc",
      materialId: material.id,
      activitiableType: "HtmlActivity",
      activitiableId: htmlActivitiable.id,
    });

    const result = await claude.run(
      `교안 활동 ID "${activity.id}"에 페이지를 설정해줘. ` +
        `URL은 "https://example.com/api-page"이고, ` +
        `진행도 계산 방식은 "API와 연동하여 측정(no_calculation)"으로 해줘.`,
    );

    expect(result.errors).toHaveLength(0);

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_html_activity_pages",
    );
    expect(interaction!.result!.isError).toBe(false);

    const input = interaction!.call.input;
    const page = (input.pages as Array<Record<string, unknown>>)[0];
    expect(page.progress_calculation_method).toBe("no_calculation");
  });

  test("교안 활동 페이지 수정 (URL 변경)", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const htmlActivitiable = await factory.create("html_activity");
    const activity = await factory.create("activity", {
      name: "E2E Html Activity 2",
      materialId: material.id,
      activitiableType: "HtmlActivity",
      activitiableId: htmlActivitiable.id,
    });
    await factory.create("html_activity_page", {
      htmlActivityId: htmlActivitiable.id,
      url: "https://example.com/old-page",
      position: 0,
      progressCalculationMethod: "no_calculation",
    });

    const result = await claude.run(
      `교안 활동 ID "${activity.id}"의 페이지를 설정해줘. ` +
        `페이지 URL은 "https://example.com/new-page"야.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain(
      "mcp__codle__manage_html_activity_pages",
    );

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_html_activity_pages",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/교안 페이지 설정 완료/);
  });
});
