import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ActivitySetFlow extends BaseCommand {
  static description = "활동들의 선형 코스 흐름(transition)을 설정합니다.";

  static flags = {
    "material-id": Flags.string({
      required: true,
      description: "자료 ID",
    }),
    "activity-ids": Flags.string({
      required: true,
      multiple: true,
      description: "순서대로 연결할 활동 ID 목록 (최소 2개)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitySetFlow);
    const activityIds = flags["activity-ids"];

    if (activityIds.length < 2) {
      this.error("activity-ids는 최소 2개 이상이어야 합니다.", { exit: 1 });
    }

    // Step 1: get existing transitions
    const matResp = await this.client.getMaterial(flags["material-id"], {
      include: "activity_transitions",
    });
    const included =
      ((matResp as Record<string, unknown>).included as Array<
        Record<string, unknown>
      >) || [];
    const existingTransitions = included.filter(
      (i) => i.type === "activity_transition",
    );

    // Step 2: level 없는 transition -> linear -> destroy
    const dataToDestroy: { id: string }[] = [];
    for (const t of existingTransitions) {
      const attrs = (t.attributes as Record<string, unknown>) || {};
      if (!attrs.level) {
        dataToDestroy.push({ id: String(t.id) });
      }
    }

    // Step 3: create pairs
    const dataToCreate: Record<string, unknown>[] = [];
    for (let i = 0; i < activityIds.length - 1; i++) {
      dataToCreate.push({
        attributes: {
          before_activity_id: activityIds[i],
          after_activity_id: activityIds[i + 1],
        },
      });
    }

    // Step 4: atomic replace
    const payload: Record<string, unknown> = { data_to_create: dataToCreate };
    if (dataToDestroy.length) {
      payload.data_to_destroy = dataToDestroy;
    }

    await this.client.doManyActivityTransitions(payload);

    const chain = activityIds.join(" → ");
    const destroyedMsg = dataToDestroy.length
      ? `, 기존 선형 transition ${dataToDestroy.length}개 제거`
      : "";
    this.log(`코스 흐름 설정 완료: ${chain}${destroyedMsg}`);
  }
}
