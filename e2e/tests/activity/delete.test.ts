import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findAllCodleInteractions,
} from "../../lib/ndjson.js";

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
