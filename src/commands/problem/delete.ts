import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { deleteProblem } from "../../services/problem.service.js";

export default class ProblemDelete extends BaseCommand {
  static override description = "문제를 삭제합니다.";

  static override args = {
    id: Args.string({ description: "문제 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ProblemDelete);
    const result = await deleteProblem(this.client, args.id);
    this.log(result.text);
  }
}
