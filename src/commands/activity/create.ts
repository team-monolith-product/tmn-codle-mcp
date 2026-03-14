import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { createActivity } from "../../services/activity.service.js";

export default class ActivityCreate extends BaseCommand {
  static override description = "활동(Activity)을 생성합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    "material-id": Flags.string({ description: "자료 ID", required: true }),
    name: Flags.string({ description: "활동 이름 (최대 64자)", required: true }),
    "activity-type": Flags.string({
      description: "활동 유형. Html, Quiz, Board, Sheet, Video, Embedded 등",
      required: true,
    }),
    depth: Flags.integer({ description: "활동 깊이, 1-indexed (1=메인, 2=하위)" }),
    "tag-ids": Flags.string({ description: "연결할 태그 ID 목록 (쉼표 구분)" }),
    "entry-category": Flags.string({
      options: ["project", "stage"],
      description: "엔트리 활동 카테고리 (EntryActivity일 때 필수)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityCreate);
    const result = await createActivity(this.client, {
      material_id: flags["material-id"],
      name: flags.name,
      activity_type: flags["activity-type"],
      depth: flags.depth,
      tag_ids: flags["tag-ids"]?.split(","),
      entry_category: flags["entry-category"] as "project" | "stage" | undefined,
    });
    this.outputResult(result.activity, () => result.text);
  }
}
