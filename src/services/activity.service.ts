import { CodleClient } from "../api/client.js";
import { CodleAPIError } from "../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../api/models.js";

const ACTIVITIABLE_ENDPOINTS: Record<string, string> = {
  QuizActivity: "/api/v1/quiz_activities",
  StudioActivity: "/api/v1/studio_activities",
  EntryActivity: "/api/v1/entry_activities",
  ScratchActivity: "/api/v1/scratch_activities",
  BoardActivity: "/api/v1/board_activities",
  VideoActivity: "/api/v1/video_activities",
  PdfActivity: "/api/v1/pdf_activities",
  SheetActivity: "/api/v1/sheet_activities",
  HtmlActivity: "/api/v1/html_activities",
  GenerativeHtmlActivity: "/api/v1/generative_html_activities",
  MakecodeActivity: "/api/v1/makecode_activities",
  CodapActivity: "/api/v1/codap_activities",
  EmbeddedActivity: "/api/v1/embedded_activities",
  SocroomActivity: "/api/v1/socroom_activities",
  AiRecommendQuizActivity: "/api/v1/ai_recommend_quiz_activities",
};

const ACTIVITIABLE_TYPES = Object.keys(ACTIVITIABLE_ENDPOINTS);

/** "Quiz" → "QuizActivity", "QuizActivity" → "QuizActivity" */
export function normalizeActivityType(input: string): string {
  if (ACTIVITIABLE_TYPES.includes(input)) return input;
  const withSuffix = input + "Activity";
  if (ACTIVITIABLE_TYPES.includes(withSuffix)) return withSuffix;
  return input;
}

export function pascalToSnake(name: string): string {
  let result = "";
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if (c >= "A" && c <= "Z" && i > 0) {
      result += "_";
    }
    result += c.toLowerCase();
  }
  return result;
}

export function getValidActivityTypes(): string[] {
  return ACTIVITIABLE_TYPES;
}

export interface CreateActivityParams {
  material_id: string;
  name: string;
  activity_type: string;
  depth?: number;
  tag_ids?: string[];
  entry_category?: "project" | "stage";
}

export async function createActivity(
  client: CodleClient,
  params: CreateActivityParams,
): Promise<{ activity: Record<string, unknown>; text: string }> {
  const resolvedType = normalizeActivityType(params.activity_type);
  if (!ACTIVITIABLE_TYPES.includes(resolvedType)) {
    throw new Error(
      `유효하지 않은 activity_type: ${params.activity_type}. 사용 가능: ${ACTIVITIABLE_TYPES.join(", ")}`,
    );
  }

  if (resolvedType === "EntryActivity" && !params.entry_category) {
    throw new Error(
      "EntryActivity 생성 시 entry_category(project 또는 stage)는 필수입니다.",
    );
  }

  // 1단계: activitiable 생성
  const endpoint = ACTIVITIABLE_ENDPOINTS[resolvedType];
  const jsonapiType = pascalToSnake(resolvedType);
  const activitiableAttrs: Record<string, unknown> = {};
  // AIDEV-NOTE: entry_category는 Rails EntryActivity에 validates_immutable :category가 있어
  // 생성 후 변경 불가. 따라서 create 시에만 설정하며, update_activitiable로 이관하지 않는다.
  if (resolvedType === "EntryActivity" && params.entry_category) {
    activitiableAttrs.category = params.entry_category;
  }
  const activitiablePayload = {
    data: { type: jsonapiType, attributes: activitiableAttrs },
  };

  const activitiableResponse = await client.request("POST", endpoint, {
    json: activitiablePayload,
  });
  const activitiableData =
    (activitiableResponse.data as Record<string, unknown>) || {};
  const activitiableId = String(activitiableData.id || "");
  if (!activitiableId) {
    throw new Error(`activitiable(${resolvedType}) 생성 실패: 응답에 id 없음.`);
  }

  // 2단계: activity 생성
  // depth: 1-indexed (사용자) → 0-indexed (Rails API). 미지정 시 1(=메인)
  const apiDepth = Math.max(0, (params.depth ?? 1) - 1);
  const attrs: Record<string, unknown> = {
    name: params.name,
    material_id: params.material_id,
    depth: apiDepth,
    activitiable_type: resolvedType,
    activitiable_id: activitiableId,
  };
  if (params.tag_ids?.length) attrs.tag_ids = params.tag_ids;

  const payload = buildJsonApiPayload("activities", attrs);
  const response = await client.createActivity(
    payload as Record<string, unknown>,
  );
  const activity = extractSingle(response);

  return {
    activity,
    text: `활동 생성 완료: [${activity.id}] ${activity.name} (type: ${resolvedType})`,
  };
}

export interface UpdateActivityParams {
  activity_id: string;
  name?: string;
  depth?: number;
  tag_ids?: string[];
}

export async function updateActivity(
  client: CodleClient,
  params: UpdateActivityParams,
): Promise<{ activity: Record<string, unknown>; text: string }> {
  const attrs: Record<string, unknown> = {};
  if (params.name !== undefined) attrs.name = params.name;
  if (params.depth !== undefined) attrs.depth = Math.max(0, params.depth - 1);
  if (params.tag_ids !== undefined) attrs.tag_ids = params.tag_ids;

  if (!Object.keys(attrs).length) {
    return { activity: {}, text: "수정할 항목이 없습니다." };
  }

  const payload = buildJsonApiPayload("activities", attrs, params.activity_id);
  const response = await client.updateActivity(
    params.activity_id,
    payload as Record<string, unknown>,
  );
  const activity = extractSingle(response);

  return {
    activity,
    text: `활동 수정 완료: [${activity.id}] ${activity.name}`,
  };
}

export async function deleteActivity(
  client: CodleClient,
  activityId: string,
): Promise<{ text: string }> {
  await client.deleteActivity(activityId);
  return { text: `활동 삭제 완료: ${activityId}` };
}

export async function duplicateActivity(
  client: CodleClient,
  activityId: string,
): Promise<{ activity: Record<string, unknown>; text: string }> {
  const response = await client.duplicateActivity(activityId);
  const activity = extractSingle(response);
  return {
    activity,
    text: `활동 복제 완료: [${activity.id}] ${activity.name} (원본: ${activityId})`,
  };
}

export interface SetActivityFlowParams {
  material_id: string;
  activity_ids: string[];
}

export async function setActivityFlow(
  client: CodleClient,
  params: SetActivityFlowParams,
): Promise<{ text: string }> {
  // 1단계: 기존 transition 조회
  const matResp = await client.getMaterial(params.material_id, {
    include: "activity_transitions",
  });
  const included =
    ((matResp as Record<string, unknown>).included as Array<
      Record<string, unknown>
    >) || [];
  const existingTransitions = included.filter(
    (i) => i.type === "activity_transition",
  );

  // 2단계: level 없는 transition → 선형 → 삭제 대상
  const dataToDestroy: { id: string }[] = [];
  for (const t of existingTransitions) {
    const attrs = (t.attributes as Record<string, unknown>) || {};
    if (!attrs.level) {
      dataToDestroy.push({ id: String(t.id) });
    }
  }

  // 3단계: 연속 쌍으로 생성 목록 구성
  const dataToCreate: Record<string, unknown>[] = [];
  for (let i = 0; i < params.activity_ids.length - 1; i++) {
    dataToCreate.push({
      attributes: {
        before_activity_id: params.activity_ids[i],
        after_activity_id: params.activity_ids[i + 1],
      },
    });
  }

  // 4단계: 원자적 교체
  const payload: Record<string, unknown> = {
    data_to_create: dataToCreate,
  };
  if (dataToDestroy.length) {
    payload.data_to_destroy = dataToDestroy;
  }

  await client.doManyActivityTransitions(payload);

  const chain = params.activity_ids.join(" → ");
  const destroyedMsg = dataToDestroy.length
    ? `, 기존 선형 transition ${dataToDestroy.length}개 제거`
    : "";
  return { text: `코스 흐름 설정 완료: ${chain}${destroyedMsg}` };
}

export interface SetActivityBranchParams {
  material_id: string;
  branch_from: string;
  mid_activity_id: string;
  low_activity_id?: string;
  high_activity_id?: string;
}

export async function setActivityBranch(
  client: CodleClient,
  params: SetActivityBranchParams,
): Promise<{ text: string }> {
  // 1단계: 기존 transition 조회
  const matResp = await client.getMaterial(params.material_id, {
    include: "activity_transitions",
  });
  const included =
    ((matResp as Record<string, unknown>).included as Array<
      Record<string, unknown>
    >) || [];
  const existingTransitions = included.filter(
    (i) => i.type === "activity_transition",
  );

  // AIDEV-NOTE: level 구분 없이 branch_from의 모든 transition 삭제가 의도된 동작.
  // 갈림길은 선형 흐름을 대체하므로 기존 linear transition도 함께 제거해야 한다.
  // cf. codle-react useBranchBundleCreate.tsx
  const dataToDestroy: { id: string }[] = [];
  for (const t of existingTransitions) {
    const attrs = (t.attributes as Record<string, unknown>) || {};
    if (String(attrs.before_activity_id) === String(params.branch_from)) {
      dataToDestroy.push({ id: String(t.id) });
    }
  }

  // 2단계: 생성할 transition 목록
  const levelMap: Record<string, string | undefined> = {
    mid: params.mid_activity_id,
    low: params.low_activity_id,
    high: params.high_activity_id,
  };
  const dataToCreate: Record<string, unknown>[] = [];
  for (const [level, afterId] of Object.entries(levelMap)) {
    if (afterId) {
      dataToCreate.push({
        attributes: {
          before_activity_id: params.branch_from,
          after_activity_id: afterId,
          level,
        },
      });
    }
  }

  if (dataToCreate.length < 2) {
    throw new Error(
      "갈림길은 최소 2개 이상의 활동이 필요합니다. mid_activity_id와 low_activity_id 또는 high_activity_id를 지정하세요.",
    );
  }

  // 3단계: do_many
  const payload: Record<string, unknown> = {
    data_to_create: dataToCreate,
  };
  if (dataToDestroy.length) {
    payload.data_to_destroy = dataToDestroy;
  }

  await client.doManyActivityTransitions(payload);

  const levelsCreated = Object.entries(levelMap)
    .filter(([, v]) => v)
    .map(([level, afterId]) => `${level}=${afterId}`);
  const destroyedMsg = dataToDestroy.length
    ? `, 기존 transition ${dataToDestroy.length}개 제거`
    : "";
  return {
    text: `갈림길 설정 완료: ${params.branch_from} → ${levelsCreated.join(", ")}${destroyedMsg}`,
  };
}
