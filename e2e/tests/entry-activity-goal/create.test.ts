import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("entry-activity-goal create", () => {
  test("엔트리 활동 목표 생성", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const entryActivitiable = await factory.create("entry_activity", {
      category: "project",
    });
    // AIDEV-NOTE: activity 생성은 entry_activity → material 간 소유자 연결에 필요.
    // 컨트롤러의 check_owner!가 entry_activity.activity.material.user_id를 확인한다.
    await createActivity(factory, material.id, {
      name: "E2E Entry Goal Test",
      activitiableType: "EntryActivity",
      activitiableId: entryActivitiable.id,
    });

    const result = await claude.run(
      `엔트리 활동 ID "${entryActivitiable.id}"에 목표를 생성해줘. content는 "목표: 블록코딩으로 캐릭터 움직이기"로 하고 position은 0으로 해.`,
    );

    expectCodleCommand(result, "entry-activity-goal create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "entry-activity-goal create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
  });
});
