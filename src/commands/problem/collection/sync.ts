import { Flags } from "@oclif/core";

import { CodleClient } from "../../../api/client.js";
import { BaseCommand } from "../../../base-command.js";

interface ExistingPcp {
  id: string;
  problemId: string;
  position: number;
  point: number;
}

interface ActivityPcpState {
  pcId: string;
  existingPcps: ExistingPcp[];
}

async function getActivityPcpState(
  client: CodleClient,
  activityId: string,
): Promise<ActivityPcpState> {
  // AIDEV-NOTE: serializer가 lazy_load_data: true이므로 include 파라미터가 있어야 relationship data가 채워진다.
  const actResp = await client.request(
    "GET",
    `/api/v1/activities/${activityId}`,
    { params: { include: "problem_collections.pcps" } },
  );
  const actData = (actResp.data as Record<string, unknown>) || {};
  const rels = (actData.relationships as Record<string, unknown>) || {};
  const pcRel =
    (rels.problem_collections as Record<string, unknown>) || {};
  const pcRelData = pcRel.data as
    | Array<Record<string, unknown>>
    | undefined;
  if (!pcRelData?.length) {
    throw new Error(
      `활동 ${activityId}에 연결된 ProblemCollection이 없습니다.`,
    );
  }
  const pcId = String(pcRelData[0].id);
  const included =
    (
      (actResp as Record<string, unknown>)
        .included as Array<Record<string, unknown>>
    ) || [];
  const existingPcps: ExistingPcp[] = included
    .filter((i) => i.type === "problem_collections_problem")
    .map((i) => {
      const attrs = (i.attributes as Record<string, unknown>) || {};
      return {
        id: String(i.id),
        problemId: String(attrs.problem_id),
        position: Number(attrs.position ?? 0),
        point: Number(attrs.point ?? 1),
      };
    });
  return { pcId, existingPcps };
}

interface DesiredProblem {
  id: string;
  point?: number;
}

export default class ProblemCollectionSync extends BaseCommand {
  static description =
    "활동의 ProblemCollection에 문제 목록을 동기화합니다.";

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "활동 ID",
    }),
    problems: Flags.string({
      required: true,
      description:
        '문제 목록 JSON [{id, point?}] (예: [{"id":"1","point":2}])',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProblemCollectionSync);

    const desiredProblems: DesiredProblem[] = JSON.parse(flags.problems);
    const state = await getActivityPcpState(
      this.client,
      flags["activity-id"],
    );
    const { pcId, existingPcps } = state;

    const existingByProblemId = new Map<string, ExistingPcp>();
    for (const pcp of existingPcps) {
      existingByProblemId.set(pcp.problemId, pcp);
    }

    const dataToCreate: Array<{ attributes: Record<string, unknown> }> =
      [];
    const dataToUpdate: Array<{
      id: string;
      attributes: Record<string, unknown>;
    }> = [];
    const desiredProblemIds = new Set<string>();

    for (let i = 0; i < desiredProblems.length; i++) {
      const desired = desiredProblems[i];
      const point = desired.point ?? 1;
      const position = i;
      desiredProblemIds.add(desired.id);

      const existing = existingByProblemId.get(desired.id);
      if (existing) {
        if (existing.position !== position || existing.point !== point) {
          dataToUpdate.push({
            id: existing.id,
            attributes: { position, point },
          });
        }
      } else {
        dataToCreate.push({
          attributes: {
            problem_collection_id: pcId,
            problem_id: desired.id,
            position,
            point,
          },
        });
      }
    }

    const dataToDestroy: Array<{ id: string }> = [];
    for (const pcp of existingPcps) {
      if (!desiredProblemIds.has(pcp.problemId)) {
        dataToDestroy.push({ id: pcp.id });
      }
    }

    if (
      !dataToCreate.length &&
      !dataToUpdate.length &&
      !dataToDestroy.length
    ) {
      this.log("변경 사항이 없습니다.");
      return;
    }

    await this.client.doManyPCP({
      data_to_create: dataToCreate,
      data_to_update: dataToUpdate,
      data_to_destroy: dataToDestroy,
    });

    const parts: string[] = [
      `ProblemCollection [${pcId}] 동기화 완료`,
    ];
    if (dataToCreate.length)
      parts.push(`추가: ${dataToCreate.length}건`);
    if (dataToUpdate.length)
      parts.push(`수정: ${dataToUpdate.length}건`);
    if (dataToDestroy.length)
      parts.push(`삭제: ${dataToDestroy.length}건`);
    this.log(parts.join(" / "));
  }
}
