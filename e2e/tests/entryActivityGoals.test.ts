import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

describe("entry-activity-goal create + list", () => {
  test("엔트리 활동 목표를 생성하고 목록을 조회", async ({
    claude,
    factory,
  }) => {
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

    const createResult = await claude.run(
      `엔트리 활동 ID "${entryActivitiable.id}"에 목표를 생성해줘. content는 "목표: 블록코딩으로 캐릭터 움직이기"로 하고 position은 0으로 해.`,
    );

    expectCodleCommand(createResult, "entry-activity-goal create");

    const createInteraction = findCodleInteraction(
      createResult.toolInteractions,
      "entry-activity-goal create",
    );
    expect(createInteraction?.result).toBeDefined();
    expect(createInteraction!.result!.isError).toBe(false);

    const createOutput = parseCodleOutput<{ id: string }>(
      createInteraction!.result!,
    );
    expect(createOutput).toHaveProperty("id");

    const listResult = await claude.run(
      `엔트리 활동 ID "${entryActivitiable.id}"의 목표 목록을 조회해줘.`,
    );

    expectCodleCommand(listResult, "entry-activity-goal list");

    const listInteraction = findCodleInteraction(
      listResult.toolInteractions,
      "entry-activity-goal list",
    );
    expect(listInteraction?.result).toBeDefined();
    expect(listInteraction!.result!.isError).toBe(false);

    const listOutput = JSON.stringify(
      parseCodleOutput(listInteraction!.result!),
    );
    expect(listOutput).toContain(createOutput.id);
  });
});
