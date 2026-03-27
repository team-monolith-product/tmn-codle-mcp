import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ActivitySetBranch extends BaseCommand {
  static description =
    "갈림길을 설정합니다. 분기점 활동에서 레벨별(mid 필수, low/high 선택) 활동으로 분기합니다.";

  static examples = [
    "<%= config.bin %> <%= command.id %> --material-id 1 --from 50 --mid 51 --low 52",
    "<%= config.bin %> <%= command.id %> --material-id 1 --from 50 --mid 51 --low 52 --high 53",
  ];

  static flags = {
    "material-id": Flags.string({
      required: true,
      description: "자료 ID",
    }),
    from: Flags.string({
      required: true,
      description: "갈림길 시작 활동 ID",
    }),
    mid: Flags.string({
      required: true,
      description: "중급 레벨 활동 ID",
    }),
    low: Flags.string({
      description: "하급 레벨 활동 ID",
    }),
    high: Flags.string({
      description: "상급 레벨 활동 ID",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitySetBranch);

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

    // AIDEV-NOTE: level 구분 없이 branch_from의 모든 transition 삭제가 의도된 동작.
    // 갈림길은 선형 흐름을 대체하므로 기존 linear transition도 함께 제거해야 한다.
    // cf. codle-react useBranchBundleCreate.tsx
    const dataToDestroy: { id: string }[] = [];
    for (const t of existingTransitions) {
      const attrs = (t.attributes as Record<string, unknown>) || {};
      if (String(attrs.before_activity_id) === String(flags.from)) {
        dataToDestroy.push({ id: String(t.id) });
      }
    }

    // Step 2: transitions to create
    const levelMap: Record<string, string | undefined> = {
      mid: flags.mid,
      low: flags.low,
      high: flags.high,
    };
    const dataToCreate: Record<string, unknown>[] = [];
    for (const [level, afterId] of Object.entries(levelMap)) {
      if (afterId) {
        dataToCreate.push({
          attributes: {
            before_activity_id: flags.from,
            after_activity_id: afterId,
            level,
          },
        });
      }
    }

    if (dataToCreate.length < 2) {
      this.error(
        "갈림길은 최소 2개 이상의 활동이 필요합니다. --mid와 --low 또는 --high를 지정하세요.",
        { exit: 1 },
      );
    }

    // Step 3: do_many
    const payload: Record<string, unknown> = { data_to_create: dataToCreate };
    if (dataToDestroy.length) {
      payload.data_to_destroy = dataToDestroy;
    }

    await this.client.doManyActivityTransitions(payload);

    this.output({
      branch_from: flags.from,
      levels: Object.fromEntries(Object.entries(levelMap).filter(([, v]) => v)),
      created: dataToCreate.length,
      destroyed: dataToDestroy.length,
    });
  }
}
