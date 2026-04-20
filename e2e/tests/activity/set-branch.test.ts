import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

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
