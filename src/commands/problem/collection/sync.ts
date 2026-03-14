import { Flags } from "@oclif/core";
import { BaseCommand } from "../../../base-command.js";
import { syncProblemCollection } from "../../../services/problem.service.js";

export default class ProblemCollectionSync extends BaseCommand {
  static override description = "활동의 문제 목록을 선언적으로 설정합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    "activity-id": Flags.string({ description: "활동 ID", required: true }),
    "problems-json": Flags.string({
      description: '최종 문제 목록 JSON. 예: \'[{"id":"p1","point":2},{"id":"p2"}]\'',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProblemCollectionSync);
    const problems = JSON.parse(flags["problems-json"]) as Array<{
      id: string;
      point?: number;
    }>;
    const result = await syncProblemCollection(this.client, {
      activity_id: flags["activity-id"],
      problems,
    });
    this.log(result.text);
  }
}
