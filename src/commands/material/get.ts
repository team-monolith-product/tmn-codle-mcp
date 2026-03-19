import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle, snakeToPascal } from "../../api/models.js";

export default class MaterialGet extends BaseCommand {
  static description = "자료(Material) 상세 정보를 조회합니다.";

  static flags = {
    "material-id": Flags.string({
      description: "조회할 자료 ID",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialGet);

    const params = {
      include:
        "activities,activities.activitiable,tags,activity_transitions",
    };
    const response = await this.client.getMaterial(
      flags["material-id"],
      params,
    );
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
      .map(
        (i): Record<string, unknown> => ({
          id: i.id,
          ...((i.attributes as Record<string, unknown>) || {}),
        }),
      );

    // Parse transitions from included
    const transitions = included
      .filter((i) => i.type === "activity_transition")
      .map(
        (i): Record<string, unknown> => ({
          id: i.id,
          ...((i.attributes as Record<string, unknown>) || {}),
        }),
      );

    // Format output
    const lines = [
      `자료: ${material.name ?? "(무제)"}`,
      `ID: ${material.id}`,
      `공개: ${material.is_public ? "예" : "아니오"}`,
      `공식: ${material.is_official ? "예" : "아니오"}`,
      `레벨: ${material.level ?? 0}`,
    ];

    if (tags.length) {
      const tagNames = tags.map((t) => `${t.name ?? ""} (${t.domain ?? ""})`);
      lines.push(`태그: ${tagNames.join(", ")}`);
    }

    if (activities.length) {
      lines.push(`\n활동 (${activities.length}개):`);
      for (const a of activities) {
        const depthVal = Number(a.depth) || 0;
        const depthPrefix = "  ".repeat(depthVal);
        let actType = String(a.activitiable_type || "");
        const hasActivitiable = !!a.activitiable_id;
        if (!actType) {
          actType = !hasActivitiable ? "미연결" : "?";
        }
        const needsProblems = ["QuizActivity", "SheetActivity"].includes(
          actType,
        );
        const problemInfo = needsProblems ? ", 문제 연결 필요" : "";
        const activitiableInfo = hasActivitiable
          ? `, activitiable_id: ${a.activitiable_id}`
          : "";
        const displayDepth = depthVal + 1;
        lines.push(
          `  ${depthPrefix}[${a.id}] ${a.name ?? "(무제)"} (type: ${actType}, depth: ${displayDepth}${activitiableInfo}${problemInfo})`,
        );
      }
    } else {
      lines.push("\n활동: 없음");
    }

    if (transitions.length) {
      const activityNames: Record<string, string> = {};
      for (const a of activities) {
        activityNames[String(a.id)] = String(a.name ?? "(무제)");
      }
      lines.push(`\n코스 흐름 (${transitions.length}개):`);
      for (const t of transitions) {
        const beforeId = String(t.before_activity_id ?? "?");
        const afterId = String(t.after_activity_id ?? "?");
        const level = t.level as string | undefined;
        const beforeName = activityNames[beforeId] ?? beforeId;
        const afterName = activityNames[afterId] ?? afterId;
        if (level) {
          lines.push(
            `  [${beforeId}] ${beforeName} →(${level}) [${afterId}] ${afterName}`,
          );
        } else {
          lines.push(
            `  [${beforeId}] ${beforeName} → [${afterId}] ${afterName}`,
          );
        }
      }
    }

    this.log(lines.join("\n"));
  }
}
