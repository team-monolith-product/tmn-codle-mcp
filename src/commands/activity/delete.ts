import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ActivityDelete extends BaseCommand {
  static description = "활동(Activity)을 삭제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> --activity-id 456"];

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "삭제할 활동 ID",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityDelete);
    await this.client.deleteActivity(flags["activity-id"]);
    this.output({ id: flags["activity-id"], deleted: true });
  }
}
