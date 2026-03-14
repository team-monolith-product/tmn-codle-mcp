import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { setActivityBranch } from "../../services/activity.service.js";

export default class ActivitySetBranch extends BaseCommand {
  static override description = "갈림길 transition을 일괄 설정합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    "material-id": Flags.string({ description: "자료 ID", required: true }),
    "branch-from": Flags.string({ description: "분기점 활동 ID", required: true }),
    "mid-activity-id": Flags.string({ description: "기본 갈림길 활동 ID (필수)", required: true }),
    "low-activity-id": Flags.string({ description: "보완 갈림길 활동 ID" }),
    "high-activity-id": Flags.string({ description: "정복 갈림길 활동 ID" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitySetBranch);
    const result = await setActivityBranch(this.client, {
      material_id: flags["material-id"],
      branch_from: flags["branch-from"],
      mid_activity_id: flags["mid-activity-id"],
      low_activity_id: flags["low-activity-id"],
      high_activity_id: flags["high-activity-id"],
    });
    this.log(result.text);
  }
}
