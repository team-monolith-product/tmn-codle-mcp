import { Flags } from "@oclif/core";

import { CodleClient } from "../../api/client.js";
import { BaseCommand } from "../../base-command.js";

interface ExistingPcp {
  id: string;
  problemId: string;
  position: number;
  point: number;
  isRequired: boolean;
}

interface ActivityPcpState {
  pcId: string;
  existingPcps: ExistingPcp[];
}

async function getActivityPcpState(
  client: CodleClient,
  activityId: string,
): Promise<ActivityPcpState> {
  // AIDEV-NOTE: Activity → ProblemCollection ID + 기존 PCP 목록을 조회하는 헬퍼.
  // serializer가 lazy_load_data: true이므로 include 파라미터가 있어야 relationship data가 채워진다.
  // controller의 jsonapi_include 화이트리스트는 "problem_collections.pcps"이므로 정확히 맞춰야 한다.
  const actResp = await client.request(
    "GET",
    `/api/v1/activities/${activityId}`,
    { params: { include: "problem_collections.pcps" } },
  );
  const actData = (actResp.data as Record<string, unknown>) || {};
  const rels = (actData.relationships as Record<string, unknown>) || {};
  const pcRel = (rels.problem_collections as Record<string, unknown>) || {};
  const pcRelData = pcRel.data as Array<Record<string, unknown>> | undefined;
  if (!pcRelData?.length) {
    throw new Error(
      `활동 ${activityId}에 연결된 ProblemCollection이 없습니다.`,
    );
  }
  const pcId = String(pcRelData[0].id);
  const included =
    ((actResp as Record<string, unknown>).included as Array<
      Record<string, unknown>
    >) || [];
  const existingPcps: ExistingPcp[] = included
    .filter((i) => i.type === "problem_collections_problem")
    .map((i) => {
      const attrs = (i.attributes as Record<string, unknown>) || {};
      return {
        id: String(i.id),
        problemId: String(attrs.problem_id),
        position: Number(attrs.position ?? 0),
        point: Number(attrs.point ?? 1),
        isRequired: Boolean(attrs.is_required ?? false),
      };
    });
  return { pcId, existingPcps };
}

// AIDEV-NOTE: 신규 pcp의 isRequired 기본값은 codle-react FormPcp 템플릿과 맞춘다.
// - descriptive/sheet → true (getDescriptiveFormPcp, getDefaultFormPcp(sheet))
// - quiz/judge → false (QuizActivityEditAddDialog의 객관식/주관식 템플릿)
function defaultIsRequiredForProblemType(problemType: string): boolean {
  return problemType === "descriptive" || problemType === "sheet";
}

async function fetchProblemType(
  client: CodleClient,
  problemId: string,
): Promise<string> {
  const resp = await client.request("GET", `/api/v1/problems/${problemId}`);
  const data = (resp.data as Record<string, unknown>) || {};
  const attrs = (data.attributes as Record<string, unknown>) || {};
  return String(attrs.problem_type ?? "");
}

interface DesiredProblem {
  id: string;
  point?: number;
  isRequired?: boolean;
}

export default class ActivitySetProblems extends BaseCommand {
  static description =
    "활동에 문제 목록을 설정합니다. problems 배열이 최종 상태.";

  static examples = [
    '<%= config.bin %> <%= command.id %> --activity-id 456 --problems \'[{"id":"p1"},{"id":"p2","point":2,"isRequired":true}]\'',
    "<%= config.bin %> <%= command.id %> --activity-id 456 --problems '[]'  # 문제 전체 제거",
  ];

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "활동 ID",
    }),
    problems: Flags.string({
      required: true,
      description:
        "문제 목록 JSON [{id, point?, isRequired?}]. isRequired 생략 시 신규 pcp는 문제 유형에 따라 기본값(서술형/활동지→true, 퀴즈/파이썬→false), 기존 pcp는 현재 값 유지.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitySetProblems);

    const desiredProblems: DesiredProblem[] = this.parseJsonFlag(
      "problems",
      flags.problems,
    );
    const state = await getActivityPcpState(this.client, flags["activity-id"]);
    const { pcId, existingPcps } = state;

    const existingByProblemId = new Map<string, ExistingPcp>();
    for (const pcp of existingPcps) {
      existingByProblemId.set(pcp.problemId, pcp);
    }

    const dataToCreate: Array<{ attributes: Record<string, unknown> }> = [];
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
        // AIDEV-NOTE: isRequired 생략 시 기존 값을 보존한다. 실제 변경이 있을 때만 update에 포함.
        const isRequiredChanged =
          desired.isRequired !== undefined &&
          desired.isRequired !== existing.isRequired;
        if (
          existing.position !== position ||
          existing.point !== point ||
          isRequiredChanged
        ) {
          const attributes: Record<string, unknown> = { position, point };
          if (isRequiredChanged) attributes.is_required = desired.isRequired;
          dataToUpdate.push({ id: existing.id, attributes });
        }
      } else {
        // AIDEV-NOTE: 신규 pcp의 isRequired 기본값은 문제를 조회해 problem_type으로 결정한다.
        // codle-react FormPcp 템플릿과 동일한 규칙 (descriptive/sheet→true, quiz/judge→false).
        let isRequired: boolean;
        if (desired.isRequired !== undefined) {
          isRequired = desired.isRequired;
        } else {
          const problemType = await fetchProblemType(this.client, desired.id);
          isRequired = defaultIsRequiredForProblemType(problemType);
        }
        dataToCreate.push({
          attributes: {
            problem_collection_id: pcId,
            problem_id: desired.id,
            position,
            point,
            is_required: isRequired,
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

    if (!dataToCreate.length && !dataToUpdate.length && !dataToDestroy.length) {
      this.output({
        message: "변경 사항 없음.",
        total: desiredProblems.length,
      });
      return;
    }

    await this.client.doManyPCP({
      data_to_create: dataToCreate,
      data_to_update: dataToUpdate,
      data_to_destroy: dataToDestroy,
    });

    this.output({
      created: dataToCreate.length,
      updated: dataToUpdate.length,
      destroyed: dataToDestroy.length,
      total: desiredProblems.length,
    });
  }
}
