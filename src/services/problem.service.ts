import { CodleClient } from "../api/client.js";
import { CodleAPIError } from "../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../api/models.js";
import {
  buildSelectBlock,
  buildInputBlock,
  convertFromMarkdown,
} from "../lexical/index.js";

export interface CreateProblemParams {
  title: string;
  problem_type: "quiz" | "sheet" | "descriptive";
  content?: string;
  choices?: Array<{
    text: string;
    isAnswer: boolean;
    imageUrl?: string;
    imageAlt?: string;
  }>;
  solutions?: string[];
  input_options?: {
    caseSensitive?: boolean;
    placeholder?: string;
  };
  tag_ids?: string[];
  is_public?: boolean;
  commentary?: string;
  sample_answer?: string;
  descriptive_criterium?: DescriptiveCriterium;
}

export interface DescriptiveCriterium {
  input_size?: number;
  placeholder?: string;
  scoring_element?: string;
  criteria?: Array<{ content: string; ratio: number }>;
}

export async function createProblem(
  client: CodleClient,
  params: CreateProblemParams,
): Promise<{ problem: Record<string, unknown>; text: string }> {
  let blocks: unknown | undefined;
  if (params.choices?.length) {
    blocks = buildSelectBlock(params.choices, params.content);
  } else if (params.solutions?.length) {
    blocks = buildInputBlock(params.solutions, params.input_options, params.content);
  } else if (params.content !== undefined) {
    // AIDEV-NOTE: Rails Problem 모델은 모든 타입에서 blocks presence를 요구한다.
    // sheet/descriptive 타입은 choices/solutions가 없으므로 content를 Lexical로 변환하여 blocks에 넣는다.
    blocks = convertFromMarkdown(params.content);
  }

  const attrs: Record<string, unknown> = {
    title: params.title,
    problem_type: params.problem_type,
  };
  if (params.content !== undefined) attrs.content = params.content;
  if (blocks !== undefined) attrs.blocks = blocks;
  if (params.tag_ids?.length) attrs.tag_ids = params.tag_ids;
  if (params.is_public !== undefined) attrs.is_public = params.is_public;
  // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
  if (params.commentary !== undefined)
    attrs.commentary = convertFromMarkdown(params.commentary);

  const payload = buildJsonApiPayload("problems", attrs);
  const response = await client.createProblem(
    payload as Record<string, unknown>,
  );
  const problem = extractSingle(response);
  const problemId = String(problem.id);

  const warnings: string[] = [];
  if (params.sample_answer !== undefined) {
    try {
      await client.doManyProblemAnswers({
        data_to_create: [
          {
            attributes: {
              code: params.sample_answer,
              problem_id: problemId,
            },
          },
        ],
        data_to_update: [],
        data_to_destroy: [],
      });
    } catch (e) {
      warnings.push(
        `모범답안 생성 실패: ${
          e instanceof CodleAPIError ? e.detail : String(e)
        }`,
      );
    }
  }
  if (params.descriptive_criterium) {
    try {
      await upsertDescriptiveCriterium(
        client,
        problemId,
        params.descriptive_criterium,
        "create",
      );
    } catch (e) {
      warnings.push(
        `채점기준 생성 실패: ${
          e instanceof CodleAPIError ? e.detail : String(e)
        }`,
      );
    }
  }

  let resultText = `문제 생성 완료: [${problemId}] ${problem.title}`;
  if (warnings.length) resultText += `\n⚠️ ${warnings.join("\n⚠️ ")}`;
  return { problem, text: resultText };
}

export interface UpdateProblemParams {
  problem_id: string;
  title?: string;
  content?: string;
  choices?: Array<{
    text: string;
    isAnswer: boolean;
    imageUrl?: string;
    imageAlt?: string;
  }>;
  solutions?: string[];
  input_options?: {
    caseSensitive?: boolean;
    placeholder?: string;
  };
  tag_ids?: string[];
  is_public?: boolean;
  commentary?: string;
  sample_answer?: string;
  descriptive_criterium?: DescriptiveCriterium;
}

export async function updateProblem(
  client: CodleClient,
  params: UpdateProblemParams,
): Promise<{ problem: Record<string, unknown>; text: string }> {
  let blocks: unknown | undefined;
  if (params.choices?.length) {
    blocks = buildSelectBlock(params.choices, params.content);
  } else if (params.solutions?.length) {
    blocks = buildInputBlock(params.solutions, params.input_options, params.content);
  } else if (params.content !== undefined) {
    blocks = convertFromMarkdown(params.content);
  }

  const attrs: Record<string, unknown> = {};
  if (params.title !== undefined) attrs.title = params.title;
  if (params.content !== undefined) attrs.content = params.content;
  if (blocks !== undefined) attrs.blocks = blocks;
  if (params.tag_ids !== undefined) attrs.tag_ids = params.tag_ids;
  if (params.is_public !== undefined) attrs.is_public = params.is_public;
  // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
  if (params.commentary !== undefined)
    attrs.commentary = convertFromMarkdown(params.commentary);

  const hasSideUpdates =
    params.sample_answer !== undefined ||
    params.descriptive_criterium !== undefined;
  if (!Object.keys(attrs).length && !hasSideUpdates) {
    return { problem: {}, text: "수정할 항목이 없습니다." };
  }

  let problem: Record<string, unknown> = {};
  if (Object.keys(attrs).length) {
    const payload = buildJsonApiPayload("problems", attrs, params.problem_id);
    const response = await client.updateProblem(
      params.problem_id,
      payload as Record<string, unknown>,
    );
    problem = extractSingle(response);
  } else {
    // 기본 필드 변경 없이 sample_answer/descriptive_criterium만 수정하는 경우
    const probResp = await client.request(
      "GET",
      `/api/v1/problems/${params.problem_id}`,
    );
    const probData = (probResp.data as Record<string, unknown>) || {};
    problem = {
      id: String(probData.id || params.problem_id),
      title: (probData.attributes as Record<string, unknown>)?.title,
    };
  }

  // AIDEV-NOTE: update 시에도 ProblemAnswer/DescriptiveCriterium을 upsert한다.
  // 기존 리소스가 있으면 update, 없으면 create.
  const warnings: string[] = [];
  if (params.sample_answer !== undefined) {
    try {
      const paResp = await client.request(
        "GET",
        "/api/v1/problem_answers",
        { params: { "filter[problem_id]": params.problem_id } },
      );
      const paList =
        (paResp.data as Array<Record<string, unknown>> | undefined) || [];
      if (paList.length > 0) {
        await client.doManyProblemAnswers({
          data_to_create: [],
          data_to_update: [
            {
              id: String(paList[0].id),
              attributes: { code: params.sample_answer },
            },
          ],
          data_to_destroy: [],
        });
      } else {
        await client.doManyProblemAnswers({
          data_to_create: [
            {
              attributes: {
                code: params.sample_answer,
                problem_id: params.problem_id,
              },
            },
          ],
          data_to_update: [],
          data_to_destroy: [],
        });
      }
    } catch (e) {
      warnings.push(
        `모범답안 수정 실패: ${
          e instanceof CodleAPIError ? e.detail : String(e)
        }`,
      );
    }
  }
  if (params.descriptive_criterium) {
    try {
      await upsertDescriptiveCriterium(
        client,
        params.problem_id,
        params.descriptive_criterium,
        "update",
      );
    } catch (e) {
      warnings.push(
        `채점기준 수정 실패: ${
          e instanceof CodleAPIError ? e.detail : String(e)
        }`,
      );
    }
  }

  let resultText = `문제 수정 완료: [${problem.id}] ${problem.title}`;
  if (warnings.length) resultText += `\n⚠️ ${warnings.join("\n⚠️ ")}`;
  return { problem, text: resultText };
}

export async function deleteProblem(
  client: CodleClient,
  problemId: string,
): Promise<{ text: string }> {
  await client.deleteProblem(problemId);
  return { text: `문제 삭제 완료: ${problemId}` };
}

// --- Problem Collection Problems ---

// AIDEV-NOTE: Activity → ProblemCollection ID + 기존 PCP 목록을 조회하는 헬퍼.
// serializer가 lazy_load_data: true이므로 include 파라미터가 있어야 relationship data가 채워진다.
// controller의 jsonapi_include 화이트리스트는 "problem_collections.pcps"이므로 정확히 맞춰야 한다.
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
      };
    });

  return { pcId, existingPcps };
}

export interface SyncProblemCollectionParams {
  activity_id: string;
  problems: Array<{
    id: string;
    point?: number;
  }>;
}

export async function syncProblemCollection(
  client: CodleClient,
  params: SyncProblemCollectionParams,
): Promise<{ text: string }> {
  const state = await getActivityPcpState(client, params.activity_id);
  const { pcId, existingPcps } = state;

  const existingByProblemId = new Map(
    existingPcps.map((pcp) => [pcp.problemId, pcp]),
  );

  const dataToCreate: Array<Record<string, unknown>> = [];
  const dataToUpdate: Array<Record<string, unknown>> = [];
  const dataToDestroy: Array<Record<string, unknown>> = [];

  const desiredSet = new Set(params.problems.map((p) => p.id));

  for (let i = 0; i < params.problems.length; i++) {
    const { id: problemId, point } = params.problems[i];
    const desiredPoint = point ?? 1;
    const existing = existingByProblemId.get(problemId);
    if (existing) {
      const attrs: Record<string, unknown> = {};
      if (existing.position !== i) attrs.position = i;
      if (existing.point !== desiredPoint) attrs.point = desiredPoint;
      if (Object.keys(attrs).length) {
        dataToUpdate.push({ id: existing.id, attributes: attrs });
      }
    } else {
      dataToCreate.push({
        attributes: {
          problem_collection_id: pcId,
          problem_id: problemId,
          position: i,
          point: desiredPoint,
        },
      });
    }
  }

  for (const pcp of existingPcps) {
    if (!desiredSet.has(pcp.problemId)) {
      dataToDestroy.push({ id: pcp.id });
    }
  }

  if (!dataToCreate.length && !dataToUpdate.length && !dataToDestroy.length) {
    return { text: "변경 사항 없음." };
  }

  await client.doManyPCP({
    data_to_create: dataToCreate,
    data_to_update: dataToUpdate,
    data_to_destroy: dataToDestroy,
  });

  const parts: string[] = [];
  if (dataToCreate.length) parts.push(`추가 ${dataToCreate.length}`);
  if (dataToUpdate.length) parts.push(`변경 ${dataToUpdate.length}`);
  if (dataToDestroy.length) parts.push(`제거 ${dataToDestroy.length}`);
  return {
    text: `PCP 설정 완료 (${parts.join(", ")}). 최종 문제 수: ${params.problems.length}`,
  };
}

// --- Helper ---

async function upsertDescriptiveCriterium(
  client: CodleClient,
  problemId: string,
  dc: DescriptiveCriterium,
  mode: "create" | "update",
): Promise<void> {
  const dcAttrs: Record<string, unknown> = {};
  if (dc.input_size !== undefined) dcAttrs.input_size = dc.input_size;
  if (dc.placeholder !== undefined) dcAttrs.placeholder = dc.placeholder;
  if (dc.scoring_element !== undefined)
    dcAttrs.scoring_element = dc.scoring_element;
  // AIDEV-NOTE: criteria 배열은 상/중/하 순서. API는 high/mid/low_content, high/mid/low_ratio 개별 필드.
  const [high, mid, low] = dc.criteria ?? [];
  if (high) {
    dcAttrs.high_content = high.content;
    dcAttrs.high_ratio = high.ratio;
  }
  if (mid) {
    dcAttrs.mid_content = mid.content;
    dcAttrs.mid_ratio = mid.ratio;
  }
  if (low) {
    dcAttrs.low_content = low.content;
    dcAttrs.low_ratio = low.ratio;
  }

  if (mode === "create") {
    dcAttrs.problem_id = problemId;
    await client.doManyDescriptiveCriteria({
      data_to_create: [{ attributes: dcAttrs }],
      data_to_update: [],
      data_to_destroy: [],
    });
  } else {
    const probResp = await client.request(
      "GET",
      `/api/v1/problems/${problemId}`,
      { params: { include: "descriptive_criterium" } },
    );
    const included =
      ((probResp as Record<string, unknown>).included as Array<
        Record<string, unknown>
      >) || [];
    const existingDC = included.find(
      (i) => i.type === "descriptive_criterium",
    );
    if (existingDC) {
      await client.doManyDescriptiveCriteria({
        data_to_create: [],
        data_to_update: [
          { id: String(existingDC.id), attributes: dcAttrs },
        ],
        data_to_destroy: [],
      });
    } else {
      dcAttrs.problem_id = problemId;
      await client.doManyDescriptiveCriteria({
        data_to_create: [{ attributes: dcAttrs }],
        data_to_update: [],
        data_to_destroy: [],
      });
    }
  }
}
