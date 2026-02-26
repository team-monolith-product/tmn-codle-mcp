import { vi } from "vitest";
import type { CodleClient } from "../src/api/client.js";

export function createMockClient(): CodleClient {
  return {
    userId: "test-user-123",
    ensureAuth: vi.fn(),
    request: vi.fn(),
    listMaterials: vi.fn(),
    getMaterial: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    duplicateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    listProblems: vi.fn(),
    getProblem: vi.fn(),
    createProblem: vi.fn(),
    updateProblem: vi.fn(),
    duplicateProblem: vi.fn(),
    createActivity: vi.fn(),
    getActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    duplicateActivity: vi.fn(),
    doManyActivities: vi.fn(),
    listMaterialBundles: vi.fn(),
    getMaterialBundle: vi.fn(),
    createMaterialBundle: vi.fn(),
    updateMaterialBundle: vi.fn(),
    deleteMaterialBundle: vi.fn(),
    duplicateMaterialBundle: vi.fn(),
    createActivityTransition: vi.fn(),
    deleteActivityTransition: vi.fn(),
    doManyActivityTransitions: vi.fn(),
    listTags: vi.fn(),
    listProblemCollections: vi.fn(),
    doManyProblemCollectionsProblems: vi.fn(),
    createQuizActivity: vi.fn(),
    updateQuizActivity: vi.fn(),
  } as unknown as CodleClient;
}

export function makeJsonApiResponse(
  resourceType: string,
  resourceId: string,
  attrs?: Record<string, unknown>,
  relationships?: Record<string, unknown>,
  included?: Record<string, unknown>[]
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
  included?: Record<string, unknown>[]
): Record<string, unknown> {
  const data = items.map((item) => {
    const { id, ...rest } = item;
    return { type: resourceType, id: String(id), attributes: rest };
  });
  const resp: Record<string, unknown> = { data };
  if (included) resp.included = included;
  return resp;
}
