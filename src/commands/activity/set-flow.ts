import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { setActivityFlow } from "../../services/activity.service.js";

export default class ActivitySetFlow extends BaseCommand {
  static override description = "코스 흐름(선형 연결)을 설정합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    "material-id": Flags.string({ description: "자료 ID", required: true }),
    "activity-ids": Flags.string({
      description: '활동 ID 배열 (쉼표 구분). 예: "123,41,151"',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitySetFlow);
    const result = await setActivityFlow(this.client, {
      material_id: flags["material-id"],
      activity_ids: flags["activity-ids"].split(","),
    });
    this.log(result.text);
  }
}
