import { describe, expect, test } from "../../fixtures/claude.js";
import { createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("activity create", () => {
  test("활동 생성 성공", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 "E2E Activity" 교안 활동을 추가해줘.`,
    );

    expectCodleCommand(result, "activity create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("엔트리 활동 생성 시 카테고리 지정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 "E2E Stage Entry" 엔트리 활동을 stage 카테고리로 추가해줘.`,
    );

    expectCodleCommand(result, "activity create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    // Verify the command includes entry-related flags
    const command = interaction!.call.input.command as string;
    expect(command).toMatch(/Entry(Activity)?/i);
    expect(command).toContain("stage");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});

describe("activity create --is-exam", () => {
  test("퀴즈 활동 생성 시 평가 여부 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 "E2E Exam Quiz" 퀴즈 활동을 평가용(is_exam)으로 생성해줘.`,
    );

    expectCodleCommand(result, "activity create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toMatch(/Quiz(Activity)?/i);
    expect(command).toContain("--is-exam");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});
