import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("entry-activity-goal list", () => {
  test("엔트리 활동 목표 목록 조회", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const entryActivitiable = await factory.create("entry_activity", {
      category: "project",
    });
    // AIDEV-NOTE: activity 생성은 entry_activity → material 간 소유자 연결에 필요.
    // 컨트롤러의 check_owner!가 entry_activity.activity.material.user_id를 확인한다.
    await createActivity(factory, material.id, {
      name: "E2E Entry Goal List",
      activitiableType: "EntryActivity",
      activitiableId: entryActivitiable.id,
    });

    // seed: 목표를 하나 생성해둔다
    const createResult = await claude.run(
      `엔트리 활동 ID "${entryActivitiable.id}"에 목표를 생성해줘. content는 "목표: 리스트 테스트"로 하고 position은 0으로 해.`,
    );
    const createInteraction = findCodleInteraction(
      createResult.toolInteractions,
      "entry-activity-goal create",
    );
    const created = parseCodleOutput<{ id: string }>(
      createInteraction!.result!,
    );

    const result = await claude.run(
      `엔트리 활동 ID "${entryActivitiable.id}"의 목표 목록을 조회해줘.`,
    );

    expectCodleCommand(result, "entry-activity-goal list");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "entry-activity-goal list",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain(created.id);
  });
});
