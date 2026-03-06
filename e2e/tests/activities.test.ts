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
