import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import {
  extractSingle,
  resolveJsonApi,
  snakeToPascal,
  type JsonApiResource,
  type JsonApiResponse,
} from "../../api/models.js";

export default class MaterialGet extends BaseCommand {
  static description =
    "자료(Material)의 활동, 태그, 코스 흐름을 포함한 상세 정보를 조회합니다.";

  static examples = [
    "<%= config.bin %> <%= command.id %> 123",
    "<%= config.bin %> <%= command.id %> 123 --detail",
  ];

  static args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  static flags = {
    detail: Flags.boolean({
      description:
        "활동별 세부 데이터(문제, 페이지 등)를 EF 수준으로 포함합니다",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MaterialGet);
    const materialId = args.id;

    const params = {
      include: "activities,activities.activitiable,tags,activity_transitions",
    };
    const response = await this.client.getMaterial(materialId, params);
    const material = extractSingle(response);

    const included =
      (response as { included?: JsonApiResource[] }).included ?? [];

    // Build lookup map for included resources: "type:id" -> resource
    const resourceMap = new Map<string, Record<string, unknown>>();
    for (const item of included) {
      if (item.type && item.id) {
        resourceMap.set(`${item.type}:${item.id}`, {
          id: item.id,
          ...(item.attributes as Record<string, unknown>),
        });
      }
    }

    // Parse activities with nested activitiable
    const activities: Record<string, unknown>[] = [];
    for (const item of included) {
      if (item.type !== "activity") continue;
      const attrs = (item.attributes as Record<string, unknown>) || {};
      const a: Record<string, unknown> = { id: item.id, ...attrs };

      // Resolve activitiable from relationship
      const rel =
        (item.relationships as Record<
          string,
          { data?: { type?: string; id?: string } }
        >) || {};
      const activitiableRef = rel.activitiable?.data;
      if (activitiableRef?.type && activitiableRef?.id) {
        a.activitiable_type ??= snakeToPascal(activitiableRef.type);
        a.activitiable_id ??= activitiableRef.id;
        a.activitiable =
          resourceMap.get(`${activitiableRef.type}:${activitiableRef.id}`) ??
          null;
      }

      activities.push(a);
    }

    if (flags.detail) {
      await this.fetchActivityDetails(activities);
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

  private async fetchActivityDetails(
    activities: Record<string, unknown>[],
  ): Promise<void> {
    const QUIZ_SHEET_INCLUDE = [
      "problem_collections.pcps.problem.tags",
      "problem_collections.pcps.problem.descriptive_criterium",
      "problem_collections.pcps.problem.problem_answers",
    ].join(",");

    await Promise.all(
      activities.map(async (activity) => {
        const activityId = String(activity.id);
        const activitiableId = activity.activitiable_id
          ? String(activity.activitiable_id)
          : null;
        const type = String(activity.activitiable_type ?? "");

        try {
          switch (type) {
            case "QuizActivity":
            case "SheetActivity": {
              const resp = await this.client.getActivity(activityId, {
                include: QUIZ_SHEET_INCLUDE,
              });
              const resolved = resolveJsonApi(
                resp as JsonApiResponse,
              ) as Record<string, unknown>;
              activity.problem_collections = resolved.problem_collections ?? [];
              break;
            }

            case "HtmlActivity": {
              if (!activitiableId) break;
              const resp = await this.client.getHtmlActivity(activitiableId, {
                include: "html_activity_pages",
              });
              activity.activitiable = resolveJsonApi(
                resp as JsonApiResponse,
              ) as Record<string, unknown>;
              break;
            }

            case "BoardActivity": {
              const resp = await this.client.listBoards({
                "filter[boardable_type]": "Activity",
                "filter[boardable_id]": activityId,
                include: "board_columns.root_board_posts",
              });
              const resolved = resolveJsonApi(resp as JsonApiResponse);
              activity.boards = Array.isArray(resolved) ? resolved : [];
              break;
            }

            case "SocroomActivity": {
              if (!activitiableId) break;
              const resp = await this.client.getSocroomActivity(
                activitiableId,
                { include: "socroom_threads" },
              );
              activity.activitiable = resolveJsonApi(
                resp as JsonApiResponse,
              ) as Record<string, unknown>;
              break;
            }
          }
        } catch (err) {
          activity.detail_error =
            err instanceof Error ? err.message : String(err);
        }
      }),
    );
  }
}
