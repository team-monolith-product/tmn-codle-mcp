import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("material get", () => {
  test("자료와 활동 ID 모두 포함", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id, {
      name: `e2e-activity-${Date.now()}`,
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 상세 정보를 조회해줘.`,
    );

    expectCodleCommand(result, "material get");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material get",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain(material.id);
    expect(output).toContain(activity.id);
  });
});

describe("material get --detail", () => {
  test("자세히 조회 요청 시 --detail 플래그 사용", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);
    const quizActivitiable = await factory.create("quiz_activity");
    await createActivity(factory, material.id, {
      name: `e2e-quiz-detail-${Date.now()}`,
      activitiableType: "QuizActivity",
      activitiableId: quizActivitiable.id,
    });

    const result = await claude.run(
      `자료 ID "${material.id}"를 문제, 페이지 등 세부 정보까지 자세히 조회해줘.`,
    );

    expectCodleCommand(result, "material get");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material get",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--detail");

    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain("problem_collections");
  });
});
