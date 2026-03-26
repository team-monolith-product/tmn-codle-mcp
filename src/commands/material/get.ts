import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle, snakeToPascal } from "../../api/models.js";

export default class MaterialGet extends BaseCommand {
  static description =
    "자료(Material)의 활동, 태그, 코스 흐름을 포함한 상세 정보를 조회합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> 123"];

  static args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(MaterialGet);
    const materialId = args.id;

    const params = {
      include: "activities,activities.activitiable,tags,activity_transitions",
    };
    const response = await this.client.getMaterial(materialId, params);
    const material = extractSingle(response);

    const included =
      ((response as Record<string, unknown>).included as Array<
        Record<string, unknown>
      >) || [];

    // Parse activities from included
    const activities: Record<string, unknown>[] = [];
    for (const i of included) {
      if (i.type !== "activity") continue;
      const attrs = (i.attributes as Record<string, unknown>) || {};
      const a: Record<string, unknown> = { id: i.id, ...attrs };
      if (!a.activitiable_type) {
        const relationships =
          (i.relationships as Record<string, unknown>) || {};
        const activitiable =
          (relationships.activitiable as Record<string, unknown>) || {};
        const rel = (activitiable.data as Record<string, unknown>) || {};
        if (rel.id) {
          a.activitiable_id = rel.id;
          a.activitiable_type = snakeToPascal(String(rel.type || ""));
        }
      }
      activities.push(a);
    }

    // Parse tags from included
    const tags = included
      .filter((i) => i.type === "tag")
      .map((i) => ({
        id: i.id,
        ...((i.attributes as Record<string, unknown>) || {}),
      }));

    // Parse transitions from included
    const transitions = included
      .filter((i) => i.type === "activity_transition")
      .map((i) => ({
        id: i.id,
        ...((i.attributes as Record<string, unknown>) || {}),
      }));

    this.output({ material, activities, tags, transitions });
  }
}
