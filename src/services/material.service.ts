import { CodleClient } from "../api/client.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
  formatMaterialSummary,
  snakeToPascal,
} from "../api/models.js";
import { convertFromMarkdown } from "../lexical/index.js";

export interface SearchMaterialsParams {
  query?: string;
  tag_ids?: string[];
  is_public?: boolean;
  page_size: number;
  page_number: number;
}

export interface MaterialSummary {
  id: string;
  name: string;
  is_public: boolean;
  [key: string]: unknown;
}

export async function searchMaterials(
  client: CodleClient,
  params: SearchMaterialsParams,
): Promise<{ materials: Record<string, unknown>[]; text: string }> {
  const apiParams: Record<string, string | number> = {
    "page[size]": Math.min(params.page_size, 100),
    "page[number]": params.page_number,
  };
  if (params.query) apiParams["filter[query]"] = params.query;
  if (params.is_public) {
    apiParams["filter[is_public]"] = "true";
  } else {
    const me = await client.getMe();
    const data = (me.data as Record<string, unknown>) ?? me;
    const userId = String(data.id);
    apiParams["filter[user_id]"] = userId;
  }
  if (params.tag_ids?.length) {
    apiParams["filter[tag_ids]"] = params.tag_ids.join(",");
  }

  const response = await client.listMaterials(apiParams);
  const materials = extractList(response);

  if (!materials.length) {
    return { materials, text: "검색 결과가 없습니다." };
  }

  const lines = [`자료 검색 결과 (${materials.length}건):`];
  for (const m of materials) {
    lines.push(formatMaterialSummary(m));
  }
  return { materials, text: lines.join("\n") };
}

export async function getMaterialDetail(
  client: CodleClient,
  materialId: string,
): Promise<{ material: Record<string, unknown>; text: string }> {
  const params = {
    include: "activities,activities.activitiable,tags,activity_transitions",
  };
  const response = await client.getMaterial(materialId, params);
  const material = extractSingle(response);

  const included =
    ((response as Record<string, unknown>).included as Array<
      Record<string, unknown>
    >) || [];

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

  const tags = included
    .filter((i) => i.type === "tag")
    .map(
      (i): Record<string, unknown> => ({
        id: i.id,
        ...((i.attributes as Record<string, unknown>) || {}),
      }),
    );

  const transitions = included
    .filter((i) => i.type === "activity_transition")
    .map(
      (i): Record<string, unknown> => ({
        id: i.id,
        ...((i.attributes as Record<string, unknown>) || {}),
      }),
    );

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
        `  ${depthPrefix}[${a.id}] ${
          a.name ?? "(무제)"
        } (type: ${actType}, depth: ${displayDepth}${activitiableInfo}${problemInfo})`,
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

  return {
    material: { ...material, activities, tags, transitions },
    text: lines.join("\n"),
  };
}

export interface CreateMaterialParams {
  name: string;
  is_public?: boolean;
  tag_ids?: string[];
  body?: string;
}

export async function createMaterial(
  client: CodleClient,
  params: CreateMaterialParams,
): Promise<{ material: Record<string, unknown>; text: string }> {
  const attrs: Record<string, unknown> = {
    name: params.name,
    is_public: params.is_public ?? false,
  };
  if (params.tag_ids?.length) attrs.tag_ids = params.tag_ids;
  if (params.body !== undefined) attrs.body = convertFromMarkdown(params.body);

  const payload = buildJsonApiPayload("materials", attrs);
  const response = await client.createMaterial(
    payload as Record<string, unknown>,
  );
  const mat = extractSingle(response);
  return {
    material: mat,
    text: `자료 생성 완료: [${mat.id}] ${mat.name}`,
  };
}

export interface UpdateMaterialParams {
  material_id: string;
  name?: string;
  is_public?: boolean;
  tag_ids?: string[];
  body?: string;
}

export async function updateMaterial(
  client: CodleClient,
  params: UpdateMaterialParams,
): Promise<{ material: Record<string, unknown>; text: string }> {
  const attrs: Record<string, unknown> = {};
  if (params.name !== undefined) attrs.name = params.name;
  if (params.is_public !== undefined) attrs.is_public = params.is_public;
  if (params.tag_ids !== undefined) attrs.tag_ids = params.tag_ids;
  if (params.body !== undefined) attrs.body = convertFromMarkdown(params.body);

  if (!Object.keys(attrs).length) {
    return { material: {}, text: "수정할 항목이 없습니다." };
  }

  const payload = buildJsonApiPayload("materials", attrs, params.material_id);
  const response = await client.updateMaterial(
    params.material_id,
    payload as Record<string, unknown>,
  );
  const mat = extractSingle(response);
  return {
    material: mat,
    text: `자료 수정 완료: [${mat.id}] ${mat.name}`,
  };
}

export async function duplicateMaterial(
  client: CodleClient,
  materialId: string,
): Promise<{ material: Record<string, unknown>; text: string }> {
  const response = await client.duplicateMaterial(materialId);
  const mat = extractSingle(response);
  return {
    material: mat,
    text: `자료 복제 완료: [${mat.id}] ${mat.name} (원본: ${materialId})`,
  };
}
