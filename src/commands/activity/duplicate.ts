import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { duplicateActivity } from "../../services/activity.service.js";

export default class ActivityDuplicate extends BaseCommand {
  static override description = "활동(Activity)을 복제합니다.";

  static override args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ActivityDuplicate);
    const result = await duplicateActivity(this.client, args.id);
    this.outputResult(result.activity, () => result.text);
  }
}
