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
    if (flags["tag-ids"] !== undefined) {
      // AIDEV-NOTE: --tag-ids "" (빈 문자열)은 태그 전체 삭제를 의미.
      // oclif multiple flag는 빈 배열을 표현할 수 없으므로 빈 문자열을 빈 배열로 변환.
      attrs.tag_ids = flags["tag-ids"].filter((id) => id !== "");
    }

    if (!Object.keys(attrs).length) {
      this.output({ message: "수정할 항목이 없습니다." });
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
    this.output(activity);
  }
}
