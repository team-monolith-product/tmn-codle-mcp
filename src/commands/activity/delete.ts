import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ActivityDelete extends BaseCommand {
  static description = "활동(Activity)을 삭제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> 456"];

  static args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ActivityDelete);

    await this.client.deleteActivity(args.id);
    this.output({ id: args.id, deleted: true });
  }
}
