import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { updateActivitiable } from "../../services/activitiable.service.js";

export default class ActivitiableUpdate extends BaseCommand {
  static override description =
    "활동의 activitiable 속성을 업데이트합니다. Board, Sheet, Embedded, Video 지원.";

  static override args = {
    "activity-id": Args.string({ description: "활동 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    content: Flags.string({
      description: "Board 안내문 또는 Sheet 지시문 (markdown)",
    }),
    name: Flags.string({ description: "Board 이름" }),
    url: Flags.string({ description: "외부 URL (Embedded/Video)" }),
    "goals-json": Flags.string({
      description: '학습목표 JSON 배열. 예: \'["목표1","목표2"]\'',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ActivitiableUpdate);
    const goals = flags["goals-json"]
      ? (JSON.parse(flags["goals-json"]) as string[])
      : undefined;
    const result = await updateActivitiable(this.client, {
      activity_id: args["activity-id"],
      content: flags.content,
      name: flags.name,
      url: flags.url,
      goals,
    });
    this.log(result.text);
  }
}
