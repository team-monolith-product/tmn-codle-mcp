import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

describe("activitiable update (QuizActivity)", () => {
  test("퀴즈 활동을 평가용으로 변경", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const quizActivitiable = await factory.create("quiz_activity");
    const activity = await createActivity(factory, material.id, {
      name: "E2E Quiz for Exam",
      activitiableType: "QuizActivity",
      activitiableId: quizActivitiable.id,
    });

    const result = await claude.run(
      `활동 ID "${activity.id}"의 퀴즈를 평가용(is_exam)으로 설정해줘.`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--is-exam");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });

  test("퀴즈 활동을 비평가용으로 변경", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const quizActivitiable = await factory.create("quiz_activity", {
      is_exam: true,
    });
    const activity = await createActivity(factory, material.id, {
      name: "E2E Quiz Non-Exam",
      activitiableType: "QuizActivity",
      activitiableId: quizActivitiable.id,
    });

    const result = await claude.run(
      `활동 ID "${activity.id}"의 퀴즈를 비평가용으로 설정해줘. --no-is-exam 플래그를 사용해.`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--no-is-exam");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});
