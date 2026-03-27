import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ProblemDelete extends BaseCommand {
  static description = "문제를 삭제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> 789"];

  static args = {
    id: Args.string({ description: "문제 ID", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ProblemDelete);

    await this.client.deleteProblem(args.id);
    this.output({ id: args.id, deleted: true });
  }
}
