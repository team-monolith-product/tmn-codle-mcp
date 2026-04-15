export interface JsonApiResource {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface JsonApiResponse {
  data?: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
}

export function extractAttributes(
  resource: JsonApiResource,
): Record<string, unknown> {
  return { id: resource.id ?? null, ...resource.attributes };
}

export function extractList(
  response: JsonApiResponse,
): Record<string, unknown>[] {
  const data = response.data;
  if (!Array.isArray(data)) return [];
  return data.map(extractAttributes);
}

export function extractSingle(
  response: JsonApiResponse,
): Record<string, unknown> {
  const data = response.data;
  if (Array.isArray(data) || !data) return { id: null };
  return extractAttributes(data);
}

export function extractIncluded(
  response: JsonApiResponse,
  resourceType: string,
): Record<string, unknown>[] {
  const included = response.included || [];
  return included
    .filter((item) => item.type === resourceType)
    .map(extractAttributes);
}

/**
 * JSON:API 응답의 included 배열을 재귀적으로 resolve하여 중첩 객체로 변환한다.
 * included에 존재하지 않는 relationship은 결과에서 제외된다.
 */
export function resolveJsonApi(
  response: JsonApiResponse,
): Record<string, unknown> | Record<string, unknown>[] {
  const dataArr = Array.isArray(response.data)
    ? response.data
    : response.data
    ? [response.data]
    : [];
  const allResources = [...dataArr, ...(response.included ?? [])];

  const rawMap = new Map<string, JsonApiResource>();
  for (const r of allResources) {
    if (r.type && r.id) rawMap.set(`${r.type}:${r.id}`, r);
  }

  const cache = new Map<string, Record<string, unknown>>();

  function resolve(key: string): Record<string, unknown> | null {
    if (cache.has(key)) return cache.get(key)!;
    const raw = rawMap.get(key);
    if (!raw) return null;

    const result: Record<string, unknown> = {
      id: raw.id,
      ...((raw.attributes as Record<string, unknown>) ?? {}),
    };
    cache.set(key, result);

    type RelRef = { type: string; id: string };
    const rels = raw.relationships as
      | Record<string, { data?: RelRef | RelRef[] | null }>
      | undefined;
    if (!rels) return result;

    for (const [name, rel] of Object.entries(rels)) {
      if (!rel?.data) continue;
      if (Array.isArray(rel.data)) {
        const items = rel.data
          .map((ref) => resolve(`${ref.type}:${ref.id}`))
          .filter((r): r is Record<string, unknown> => r !== null);
        if (items.length > 0) result[name] = items;
      } else {
        const item = resolve(`${rel.data.type}:${rel.data.id}`);
        if (item !== null) result[name] = item;
      }
    }

    return result;
  }

  if (Array.isArray(response.data)) {
    return dataArr.map((d) => resolve(`${d.type}:${d.id}`) ?? { id: d.id });
  }
  if (response.data) {
    return (
      resolve(`${response.data.type}:${response.data.id}`) ?? {
        id: response.data.id,
      }
    );
  }
  return {};
}

export function buildJsonApiPayload(
  resourceType: string,
  attributes: Record<string, unknown>,
  resourceId?: string,
  relationships?: Record<string, unknown>,
): JsonApiResponse {
  const data: Record<string, unknown> = {
    type: resourceType,
    attributes: Object.fromEntries(
      Object.entries(attributes).filter(
        ([, v]) => v !== null && v !== undefined,
      ),
    ),
  };
  if (resourceId) data.id = resourceId;
  if (relationships) data.relationships = relationships;
  return { data: data as unknown as JsonApiResource };
}

export function formatMaterialSummary(
  material: Record<string, unknown>,
): string {
  const pub = material.is_public ? "공개" : "비공개";
  return `- [${material.id}] ${material.name ?? "(무제)"} (${pub})`;
}

export function snakeToPascal(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
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
