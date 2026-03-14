import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { updateActivity } from "../../services/activity.service.js";

export default class ActivityUpdate extends BaseCommand {
  static override description = "활동(Activity)을 수정합니다.";

  static override args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({ description: "활동 이름 (최대 64자)" }),
    depth: Flags.integer({ description: "활동 깊이, 1-indexed (1=메인, 2=하위)" }),
    "tag-ids": Flags.string({ description: "연결할 태그 ID 목록 (쉼표 구분)" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ActivityUpdate);
    const result = await updateActivity(this.client, {
      activity_id: args.id,
      name: flags.name,
      depth: flags.depth,
      tag_ids: flags["tag-ids"]?.split(","),
    });
    this.outputResult(result.activity, () => result.text);
  }
}
