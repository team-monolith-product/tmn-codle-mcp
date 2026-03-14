import { CodleClient } from "../api/client.js";
import { CodleAPIError } from "../api/errors.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
} from "../api/models.js";
import { convertFromMarkdown } from "../lexical/index.js";

interface ActivitiableInfo {
  type: string;
  id: string;
}

async function resolveActivitiable(
  client: CodleClient,
  activityId: string,
): Promise<ActivitiableInfo> {
  const resp = await client.request("GET", `/api/v1/activities/${activityId}`, {
    params: { include: "activitiable" },
  });
  const actData = (resp.data as Record<string, unknown>) || {};
  const relationships =
    (actData.relationships as Record<string, unknown>) || {};
  const activitiable =
    (relationships.activitiable as Record<string, unknown>) || {};
  const rel = (activitiable.data as Record<string, unknown>) || {};

  const id = String(rel.id || "");
  const rawType = String(rel.type || "");

  if (!id || !rawType) {
    throw new Error(`활동 ${activityId}에서 activitiable을 찾을 수 없습니다.`);
  }

  // snake_case → PascalCase
  const type = rawType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return { type, id };
}

export interface UpdateActivitiableParams {
  activity_id: string;
  content?: string;
  name?: string;
  url?: string;
  goals?: string[];
}

export async function updateActivitiable(
  client: CodleClient,
  params: UpdateActivitiableParams,
): Promise<{ text: string }> {
  const info = await resolveActivitiable(client, params.activity_id);

  if (info.type === "BoardActivity") {
    if (params.content === undefined && params.name === undefined) {
      throw new Error(
        "BoardActivity: content 또는 name 중 하나 이상 필요합니다.",
      );
    }

    // Board는 폴리모픽 boardable로 조회
    const boardsResp = await client.listBoards({
      "filter[boardable_type]": "Activity",
      "filter[boardable_id]": params.activity_id,
    });
    const boards = extractList(boardsResp);
    if (!boards.length) {
      throw new Error(
        `활동 ${params.activity_id}에 연결된 Board가 없습니다.`,
      );
    }
    const boardId = String(boards[0].id);

    const attrs: Record<string, unknown> = {};
    if (params.content !== undefined)
      attrs.lexical = convertFromMarkdown(params.content);
    if (params.name !== undefined) attrs.name = params.name;

    const payload = buildJsonApiPayload("boards", attrs, boardId);
    const response = await client.updateBoard(
      boardId,
      payload as Record<string, unknown>,
    );
    const board = extractSingle(response);
    return {
      text: `보드 업데이트 완료: [${board.id}] (activity=${params.activity_id})`,
    };
  }

  if (info.type === "SheetActivity") {
    if (params.content === undefined) {
      throw new Error("SheetActivity: content는 필수입니다.");
    }

    const lexical = convertFromMarkdown(params.content);
    const payload = buildJsonApiPayload(
      "sheet_activities",
      { description: lexical },
      info.id,
    );
    const response = await client.updateSheetActivity(
      info.id,
      payload as Record<string, unknown>,
    );
    const sheet = extractSingle(response);
    return {
      text: `활동지 설명 업데이트 완료: [${sheet.id}] (activity=${params.activity_id})`,
    };
  }

  if (info.type === "EmbeddedActivity") {
    if (params.url === undefined && params.goals === undefined) {
      throw new Error(
        "EmbeddedActivity: url 또는 goals 중 하나 이상 필요합니다.",
      );
    }

    const attrs: Record<string, unknown> = {};
    if (params.url !== undefined) attrs.url = params.url;
    if (params.goals !== undefined) {
      attrs.goals = params.goals.map((g) => convertFromMarkdown(g));
    }

    const payload = buildJsonApiPayload(
      "embedded_activities",
      attrs,
      info.id,
    );
    const response = await client.updateEmbeddedActivity(
      info.id,
      payload as Record<string, unknown>,
    );
    const embedded = extractSingle(response);
    return {
      text: `EmbeddedActivity 업데이트 완료: [${embedded.id}] (activity=${params.activity_id})`,
    };
  }

  if (info.type === "VideoActivity") {
    if (params.url === undefined) {
      throw new Error("VideoActivity: url은 필수입니다.");
    }

    const payload = buildJsonApiPayload(
      "video_activities",
      { url: params.url },
      info.id,
    );
    await client.request("PUT", `/api/v1/video_activities/${info.id}`, {
      json: payload,
    });
    return {
      text: `VideoActivity 업데이트 완료: [${info.id}] (activity=${params.activity_id})`,
    };
  }

  throw new Error(
    `${info.type}은 update_activitiable에서 지원하지 않는 유형입니다.`,
  );
}
