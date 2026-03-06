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
