import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
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
function normalizeActivityType(input: string): string {
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

export function registerActivityTools(server: McpServer): void {
  server.tool(
    "manage_activities",
    "활동(Activity) CRUD. Quiz/Sheet는 생성 후 manage_problem_collection_problems로 문제 연결.",
    {
      action: z
        .enum(["create", "update", "delete", "duplicate"])
        .describe("수행할 작업"),
      material_id: z.string().optional().describe("자료 ID (create 시 필수)"),
      activity_id: z
        .string()
        .optional()
        .describe("활동 ID (update, delete, duplicate 시 필수)"),
      name: z
        .string()
        .optional()
        .describe("활동 이름 (create 시 필수, 최대 64자)"),
      activity_type: z
        .string()
        .optional()
        .describe(
          "활동 유형 (create 시 필수). Html, Quiz, Board, Sheet, Video, Embedded 등",
        ),
      depth: z
        .number()
        .optional()
        .describe(
          "활동 깊이, 1-indexed (1=메인, 2=하위, 3=하위의 하위). create 시 미지정이면 1",
        ),
      tag_ids: z.array(z.string()).optional().describe("연결할 태그 ID 목록"),
      url: z
        .string()
        .optional()
        .describe("URL (VideoActivity, EmbeddedActivity 전용)"),
    },
    async ({
      action,
      material_id,
      activity_id,
      name,
      activity_type,
      depth,
      tag_ids,
      url,
    }) => {
      if (action === "create") {
        if (!material_id || !name || !activity_type) {
          return {
            content: [
              {
                type: "text",
                text: "create 시 material_id, name, activity_type은 필수입니다.",
              },
            ],
          };
        }
        const resolvedType = normalizeActivityType(activity_type);
        if (!ACTIVITIABLE_TYPES.includes(resolvedType)) {
          return {
            content: [
              {
                type: "text",
                text: `유효하지 않은 activity_type: ${activity_type}. 사용 가능: ${ACTIVITIABLE_TYPES.join(
                  ", ",
                )}`,
              },
            ],
          };
        }

        // 1단계: activitiable 생성
        const endpoint = ACTIVITIABLE_ENDPOINTS[resolvedType];
        const jsonapiType = pascalToSnake(resolvedType);
        const activitiableAttrs: Record<string, unknown> = {};
        if (
          url !== undefined &&
          (resolvedType === "VideoActivity" ||
            resolvedType === "EmbeddedActivity")
        ) {
          activitiableAttrs.url = url;
        }
        const activitiablePayload = {
          data: { type: jsonapiType, attributes: activitiableAttrs },
        };
        let activitiableId: string;
        try {
          const activitiableResponse = await client.request("POST", endpoint, {
            json: activitiablePayload,
          });
          const activitiableData =
            (activitiableResponse.data as Record<string, unknown>) || {};
          activitiableId = String(activitiableData.id || "");
          if (!activitiableId) {
            return {
              content: [
                {
                  type: "text",
                  text: `activitiable(${resolvedType}) 생성 실패: 응답에 id 없음.`,
                },
              ],
            };
          }
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text",
                  text: `activitiable(${resolvedType}) 생성 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }

        // 2단계: activity 생성
        // depth: 1-indexed (사용자) → 0-indexed (Rails API). 미지정 시 1(=메인)
        const apiDepth = Math.max(0, (depth ?? 1) - 1);
        const attrs: Record<string, unknown> = {
          name,
          material_id,
          depth: apiDepth,
          activitiable_type: resolvedType,
          activitiable_id: activitiableId,
        };
        if (tag_ids?.length) attrs.tag_ids = tag_ids;

        const payload = buildJsonApiPayload("activities", attrs);
        const response = await client.createActivity(
          payload as Record<string, unknown>,
        );
        const activity = extractSingle(response);

        return {
          content: [
            {
              type: "text",
              text: `활동 생성 완료: [${activity.id}] ${activity.name} (type: ${resolvedType})`,
            },
          ],
        };
      }

      if (action === "update") {
        if (!activity_id) {
          return {
            content: [
              {
                type: "text",
                text: "update 시 activity_id는 필수입니다.",
              },
            ],
          };
        }

        const attrs: Record<string, unknown> = {};
        if (name !== undefined) attrs.name = name;
        if (depth !== undefined) attrs.depth = Math.max(0, depth - 1);
        if (tag_ids !== undefined) attrs.tag_ids = tag_ids;

        if (!Object.keys(attrs).length && url === undefined) {
          return {
            content: [{ type: "text", text: "수정할 항목이 없습니다." }],
          };
        }

        let activity: Record<string, unknown> = {};
        if (Object.keys(attrs).length) {
          const payload = buildJsonApiPayload("activities", attrs, activity_id);
          const response = await client.updateActivity(
            activity_id,
            payload as Record<string, unknown>,
          );
          activity = extractSingle(response);
        }

        // AIDEV-NOTE: url 수정 시 activity의 activitiable을 조회하여 해당 리소스를 업데이트한다.
        if (url !== undefined) {
          const actResp = await client.request(
            "GET",
            `/api/v1/activities/${activity_id}`,
          );
          const actData = (actResp.data as Record<string, unknown>) || {};
          const actAttrs =
            (actData.attributes as Record<string, unknown>) || {};
          const aType = String(actAttrs.activitiable_type || "");
          const aId = String(actAttrs.activitiable_id || "");
          if (
            aId &&
            (aType === "VideoActivity" || aType === "EmbeddedActivity")
          ) {
            const endpoint = ACTIVITIABLE_ENDPOINTS[aType];
            const jsonapiType = pascalToSnake(aType);
            await client.request("PUT", `${endpoint}/${aId}`, {
              json: {
                data: {
                  id: aId,
                  type: jsonapiType,
                  attributes: { url },
                },
              },
            });
          }
          if (!Object.keys(activity).length) {
            activity = { id: activity_id, name: actAttrs.name };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `활동 수정 완료: [${activity.id}] ${activity.name}`,
            },
          ],
        };
      }

      if (action === "delete") {
        if (!activity_id) {
          return {
            content: [
              {
                type: "text",
                text: "delete 시 activity_id는 필수입니다.",
              },
            ],
          };
        }
        try {
          await client.deleteActivity(activity_id);
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text",
                  text: `활동 삭제 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
        return {
          content: [
            {
              type: "text",
              text: `활동 삭제 완료: ${activity_id}`,
            },
          ],
        };
      }

      if (action === "duplicate") {
        if (!activity_id) {
          return {
            content: [
              {
                type: "text",
                text: "duplicate 시 activity_id는 필수입니다.",
              },
            ],
          };
        }
        const response = await client.duplicateActivity(activity_id);
        const activity = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `활동 복제 완료: [${activity.id}] ${activity.name} (원본: ${activity_id})`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `유효하지 않은 action: ${action}. create, update, delete, duplicate 중 하나를 사용하세요.`,
          },
        ],
      };
    },
  );

  server.tool(
    "set_activity_flow",
    "코스 흐름(선형 연결)을 설정합니다. 기존 선형 transition을 교체하며 갈림길은 유지.",
    {
      material_id: z.string().describe("자료 ID"),
      activity_ids: z
        .array(z.string())
        .min(2)
        .describe('활동 ID 배열 (코스 흐름 순서). 예: ["123", "41", "151"]'),
    },
    async ({ material_id, activity_ids }) => {
      // 1단계: 기존 transition 조회
      const matResp = await client.getMaterial(material_id, {
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
      for (let i = 0; i < activity_ids.length - 1; i++) {
        dataToCreate.push({
          attributes: {
            before_activity_id: activity_ids[i],
            after_activity_id: activity_ids[i + 1],
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

      try {
        await client.doManyActivityTransitions(payload);
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text",
                text: `코스 흐름 설정 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const chain = activity_ids.join(" → ");
      const destroyedMsg = dataToDestroy.length
        ? `, 기존 선형 transition ${dataToDestroy.length}개 제거`
        : "";
      return {
        content: [
          {
            type: "text",
            text: `코스 흐름 설정 완료: ${chain}${destroyedMsg}`,
          },
        ],
      };
    },
  );

  server.tool(
    "set_activity_branch",
    "갈림길 transition을 일괄 설정. branch_from의 기존 transition(선형 포함)을 교체. mid 필수, low/high 선택 (최소 2개).",
    {
      material_id: z.string().describe("자료 ID"),
      branch_from: z
        .string()
        .describe("분기점 활동 ID (이 활동에서 갈림길이 시작됨)"),
      mid_activity_id: z.string().describe("기본 갈림길 활동 ID (필수)"),
      low_activity_id: z.string().optional().describe("보완 갈림길 활동 ID"),
      high_activity_id: z.string().optional().describe("정복 갈림길 활동 ID"),
    },
    async ({
      material_id,
      branch_from,
      mid_activity_id,
      low_activity_id,
      high_activity_id,
    }) => {
      // 1단계: 기존 transition 조회
      const matResp = await client.getMaterial(material_id, {
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
        if (String(attrs.before_activity_id) === String(branch_from)) {
          dataToDestroy.push({ id: String(t.id) });
        }
      }

      // 2단계: 생성할 transition 목록
      const levelMap: Record<string, string | undefined> = {
        mid: mid_activity_id,
        low: low_activity_id,
        high: high_activity_id,
      };
      const dataToCreate: Record<string, unknown>[] = [];
      for (const [level, afterId] of Object.entries(levelMap)) {
        if (afterId) {
          dataToCreate.push({
            attributes: {
              before_activity_id: branch_from,
              after_activity_id: afterId,
              level,
            },
          });
        }
      }

      if (dataToCreate.length < 2) {
        return {
          content: [
            {
              type: "text",
              text: "갈림길은 최소 2개 이상의 활동이 필요합니다. mid_activity_id와 low_activity_id 또는 high_activity_id를 지정하세요.",
            },
          ],
        };
      }

      // 3단계: do_many
      const payload: Record<string, unknown> = {
        data_to_create: dataToCreate,
      };
      if (dataToDestroy.length) {
        payload.data_to_destroy = dataToDestroy;
      }

      try {
        await client.doManyActivityTransitions(payload);
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text",
                text: `갈림길 설정 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const levelsCreated = Object.entries(levelMap)
        .filter(([, v]) => v)
        .map(([level, afterId]) => `${level}=${afterId}`);
      const destroyedMsg = dataToDestroy.length
        ? `, 기존 transition ${dataToDestroy.length}개 제거`
        : "";
      return {
        content: [
          {
            type: "text",
            text: `갈림길 설정 완료: ${branch_from} → ${levelsCreated.join(
              ", ",
            )}${destroyedMsg}`,
          },
        ],
      };
    },
  );
}
