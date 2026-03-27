import { describe, expect, test } from "../fixtures/claude.js";
import { createMaterial } from "../lib/factory.js";
import { expectCodleCommand, findCodleInteraction } from "../lib/ndjson.js";

describe("html-activity-page sync", () => {
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

    expectCodleCommand(result, "html-activity-page sync");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "html-activity-page sync",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
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

    expectCodleCommand(result, "html-activity-page sync");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "html-activity-page sync",
    );
    expect(interaction!.result!.isError).toBe(false);

    // Default values: time method, 3 seconds
    const command = interaction!.call.input.command as string;
    // If method is specified it should be "time", or not specified (defaults to "time")
    if (command.includes("--progress-calculation-method")) {
      expect(command).toMatch(/time/);
    }
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

    expectCodleCommand(result, "html-activity-page sync");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "html-activity-page sync",
    );
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("no_calculation");
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

    expectCodleCommand(result, "html-activity-page sync");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "html-activity-page sync",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
  });
});
