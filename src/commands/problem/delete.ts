import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

export default class ProblemDelete extends BaseCommand {
  static description = "문제를 삭제합니다.";

  static flags = {
    "problem-id": Flags.string({
      required: true,
      description: "문제 ID",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProblemDelete);
    await this.client.deleteProblem(flags["problem-id"]);
    this.log(`문제 삭제 완료: [${flags["problem-id"]}]`);
  }
}
