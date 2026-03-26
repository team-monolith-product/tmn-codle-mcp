import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findAllCodleInteractions,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

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

describe("activity delete", () => {
  test("활동 삭제 호출", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id);

    const result = await claude.run(`활동 ID "${activity.id}"를 삭제해줘.`);

    expectCodleCommand(result, "activity delete");

    const deleteInteractions = findAllCodleInteractions(
      result.toolInteractions,
      "activity delete",
    );
    expect(deleteInteractions.length).toBeGreaterThanOrEqual(1);
    const lastDelete = deleteInteractions[deleteInteractions.length - 1]!;
    expect(lastDelete.result!.isError).toBe(false);
  });
});

describe("activity set-branch", () => {
  test("갈림길 설정 (기본 + 보완)", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    // AIDEV-NOTE: enable_course_branch?는 QuizActivity/SheetActivity만 허용.
    // 기본 activity factory는 StudioActivity이므로 quiz_activity를 명시적으로 생성.
    const quizActivitiable = await factory.create("quiz_activity");
    const branch = await createActivity(factory, material.id, {
      name: "Branch From",
      activitiableType: "QuizActivity",
      activitiableId: quizActivitiable.id,
    });
    const mid = await createActivity(factory, material.id, {
      name: "Mid Path",
    });
    const low = await createActivity(factory, material.id, {
      name: "Low Path",
    });

    const result = await claude.run(
      `자료 ID "${material.id}"에서 활동 "${branch.id}"를 분기점으로 갈림길을 설정해줘. ` +
        `기본 갈림길은 "${mid.id}", 보완 갈림길은 "${low.id}"야.`,
    );

    expectCodleCommand(result, "activity set-branch");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-branch",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });
});

describe("activity set-flow", () => {
  test("seed된 활동으로 코스 흐름 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity1 = await createActivity(factory, material.id, {
      name: "Flow Act 1",
    });
    const activity2 = await createActivity(factory, material.id, {
      name: "Flow Act 2",
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 활동 "${activity1.id}"와 "${activity2.id}"를 순서대로 연결하는 코스 흐름을 설정해줘.`,
    );

    expectCodleCommand(result, "activity set-flow");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-flow",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });
});
