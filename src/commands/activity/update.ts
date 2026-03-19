import { Flags } from "@oclif/core";

import { buildJsonApiPayload, extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

export default class ActivityUpdate extends BaseCommand {
  static description = "활동(Activity)을 수정합니다.";

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "수정할 활동 ID",
    }),
    name: Flags.string({
      description: "활동 이름 (최대 64자)",
    }),
    depth: Flags.integer({
      description: "활동 깊이, 1-indexed (1=메인, 2=하위)",
    }),
    "tag-ids": Flags.string({
      description: "연결할 태그 ID",
      multiple: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityUpdate);
    const attrs: Record<string, unknown> = {};

    if (flags.name !== undefined) attrs.name = flags.name;
    if (flags.depth !== undefined) attrs.depth = Math.max(0, flags.depth - 1);
    if (flags["tag-ids"] !== undefined) attrs.tag_ids = flags["tag-ids"];

    if (!Object.keys(attrs).length) {
      this.log("수정할 항목이 없습니다.");
      return;
    }

    const payload = buildJsonApiPayload(
      "activities",
      attrs,
      flags["activity-id"],
    );
    const response = await this.client.updateActivity(
      flags["activity-id"],
      payload as Record<string, unknown>,
    );
    const activity = extractSingle(response);
    this.log(`활동 수정 완료: [${activity.id}] ${activity.name}`);
  }
}
