import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

describe("activitiable update (VideoActivity — screen_narration_script)", () => {
  test("영상 활동에 나레이션 스크립트 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const videoActivitiable = await factory.create("video_activity", {
      url: "https://example.com/video",
    });
    const activity = await createActivity(factory, material.id, {
      name: "E2E Video Narration",
      activitiableType: "VideoActivity",
      activitiableId: videoActivitiable.id,
    });

    const result = await claude.run(
      `활동 ID "${activity.id}"의 영상 활동에 화면 해설 스크립트를 설정해줘. 내용은 "# 첫 번째 장면\n이 장면에서는 기본 개념을 설명합니다."로 해.`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--screen-narration-script");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});

describe("activitiable update (CodapActivity — goals)", () => {
  test("CODAP 활동에 학습 목표 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const codapActivitiable = await factory.create("codap_activity");
    const activity = await createActivity(factory, material.id, {
      name: "E2E Codap Goals",
      activitiableType: "CodapActivity",
      activitiableId: codapActivitiable.id,
    });

    const result = await claude.run(
      `활동 ID "${activity.id}"의 CODAP 활동에 학습 목표를 설정해줘. 목표 1: "데이터를 시각화할 수 있다", 목표 2: "그래프를 해석할 수 있다"`,
    );

    expectCodleCommand(result, "activitiable update");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activitiable update",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--goals");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});

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
