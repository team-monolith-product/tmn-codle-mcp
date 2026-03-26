import { Args } from "@oclif/core";

import { extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

export default class ActivityDuplicate extends BaseCommand {
  static description = "활동(Activity)을 복제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> 456"];

  static args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ActivityDuplicate);

    const response = await this.client.duplicateActivity(args.id);
    const activity = extractSingle(response);
    this.output(activity);
  }
}
