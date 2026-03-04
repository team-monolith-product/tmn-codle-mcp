export function makeJsonApiResponse(
  resourceType: string,
  resourceId: string,
  attrs?: Record<string, unknown>,
  relationships?: Record<string, unknown>,
  included?: Record<string, unknown>[],
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    type: resourceType,
    id: String(resourceId),
    attributes: attrs || {},
  };
  if (relationships) data.relationships = relationships;
  const resp: Record<string, unknown> = { data };
  if (included) resp.included = included;
  return resp;
}

export function makeJsonApiListResponse(
  resourceType: string,
  items: Array<Record<string, unknown>>,
  included?: Record<string, unknown>[],
): Record<string, unknown> {
  const data = items.map((item) => {
    const { id, ...rest } = item;
    return { type: resourceType, id: String(id), attributes: rest };
  });
  const resp: Record<string, unknown> = { data };
  if (included) resp.included = included;
  return resp;
}
