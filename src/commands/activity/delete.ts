import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { deleteActivity } from "../../services/activity.service.js";

export default class ActivityDelete extends BaseCommand {
  static override description = "활동(Activity)을 삭제합니다.";

  static override args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ActivityDelete);
    const result = await deleteActivity(this.client, args.id);
    this.log(result.text);
  }
}
