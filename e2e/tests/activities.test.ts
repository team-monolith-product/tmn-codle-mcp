import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  extractText,
  findAllToolResults,
  findToolResult,
} from "../lib/ndjson.js";

describe("manage_activities", () => {
  test("활동 생성 성공", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 "E2E Activity" 교안 활동을 추가해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_activities");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_activities",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/활동 생성 완료/);
  });

  test("엔트리 활동 생성 시 카테고리 지정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 "E2E Stage Entry" 엔트리 활동을 stage 카테고리로 추가해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_activities");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_activities",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    expect(interaction!.call.input.activity_type).toMatch(/^Entry(Activity)?$/);
    expect(interaction!.call.input.entry_category).toBe("stage");
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/활동 생성 완료/);
  });

  test("활동 삭제 호출", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id);

    const result = await claude.run(`활동 ID "${activity.id}"를 삭제해줘.`);

    expect(result.toolNames).toContain("mcp__codle__manage_activities");

    const deleteInteractions = findAllToolResults(
      result.toolInteractions,
      "mcp__codle__manage_activities",
    ).filter((i) => i.call.input.action === "delete");
    expect(deleteInteractions.length).toBeGreaterThanOrEqual(1);
    expect(deleteInteractions[0]!.result!.isError).toBe(false);
  });
});

describe("set_activity_branch", () => {
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

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__set_activity_branch");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__set_activity_branch",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/갈림길 설정 완료/);
  });
});

describe("set_activity_flow", () => {
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

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__set_activity_flow");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__set_activity_flow",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/코스 흐름/);
  });
});
