import { Flags } from "@oclif/core";

import { extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

export default class ActivityDuplicate extends BaseCommand {
  static description = "활동(Activity)을 복제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> --activity-id 456"];

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "복제할 활동 ID",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityDuplicate);
    const response = await this.client.duplicateActivity(flags["activity-id"]);
    const activity = extractSingle(response);
    this.output(activity);
  }
}
