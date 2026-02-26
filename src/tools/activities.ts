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

async function createTransition(
  beforeId: string,
  afterId: string,
  level?: string
): Promise<void> {
  const attrs: Record<string, unknown> = {
    before_activity_id: beforeId,
    after_activity_id: afterId,
  };
  if (level) attrs.level = level;
  const payload = {
    data: { type: "activity_transition", attributes: attrs },
  };
  await client.createActivityTransition(payload);
}

async function getMaterialTransitions(
  materialId: string,
  excludeId: string
): Promise<{
  transitions: Record<string, unknown>[];
  existingIds: string[];
}> {
  const matResp = await client.getMaterial(materialId, {
    include: "activities,activity_transitions",
  });
  const included = (
    (matResp as Record<string, unknown>).included as Array<
      Record<string, unknown>
    >
  ) || [];
  const transitions = included.filter(
    (i) => i.type === "activity_transition"
  );
  const existingIds = included
    .filter((i) => i.type === "activity" && i.id !== excludeId)
    .map((i) => String(i.id));
  return { transitions, existingIds };
}

export async function findTailActivity(
  materialId: string,
  excludeId: string
): Promise<string | null> {
  const { transitions, existingIds } = await getMaterialTransitions(
    materialId,
    excludeId
  );

  if (!existingIds.length) return null;

  const beforeIds = new Set(
    transitions.map((t) =>
      String(
        ((t.attributes as Record<string, unknown>) || {}).before_activity_id
      )
    )
  );
  const tails = existingIds.filter((aid) => !beforeIds.has(aid));
  return tails.length === 1 ? tails[0] : null;
}

export function registerActivityTools(server: McpServer): void {
  server.tool(
    "manage_activities",
    `자료(Material) 내 활동(Activity)을 추가, 수정, 삭제합니다.

활동은 자료를 구성하는 학습 단위입니다. 순서대로 생성하면 자동으로 선형 연결됩니다.

## 활동 유형 매핑
입력 스크립트의 키워드 → activity_type:
- 교안, 교안 실습 → HtmlActivity
- 퀴즈 → QuizActivity
- 보드 → BoardActivity
- 활동지 → SheetActivity
- 코딩, Python → StudioActivity
- 영상 → VideoActivity
- 엔트리 → EntryActivity
- 스크래치 → ScratchActivity
- PDF → PdfActivity

## 자동 연결
활동을 순서대로 create하면 이전 활동 → 새 활동 transition이 자동 생성됩니다.
반드시 코스 흐름 순서대로 생성하세요.

## depth (들여쓰기, 1-indexed)
- 1: 메인 활동 (코스 흐름에서 독립 노드)
- 2: 하위 활동 (직전 depth=1 활동의 하위로 들여쓰기 표시)
- 3: 하위의 하위
※ 내부적으로 Rails API에 보낼 때 -1 변환됨 (1→0, 2→1)

## 갈림길(branch)
branch_from을 지정하면 활동만 생성하고 transition은 생성하지 않습니다.
모든 갈림길 활동 생성 후 set_activity_branch로 분기를 일괄 설정하세요.
예) 활동 "48330"에서 3갈래 분기:
  create(..., branch_from="48330")  # 기본(mid) 활동
  create(..., branch_from="48330")  # 보완(low) 활동
  create(..., branch_from="48330")  # 정복(high) 활동
  set_activity_branch(branch_from="48330", mid_activity_id="...", low_activity_id="...", high_activity_id="...")

## 문제 연결
QuizActivity, SheetActivity 생성 후 manage_problem_collections로 문제를 연결해야 합니다.
문제가 연결되지 않으면 빈 퀴즈/활동지로 표시됩니다.`,
    {
      action: z
        .string()
        .describe(
          '수행할 작업 ("create", "update", "delete", "duplicate")'
        ),
      material_id: z
        .string()
        .optional()
        .describe("자료 ID (create 시 필수)"),
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
          "활동 유형 (create 시 필수). 주요: HtmlActivity, QuizActivity, BoardActivity, SheetActivity, StudioActivity, VideoActivity. 기타: EntryActivity, ScratchActivity, PdfActivity, GenerativeHtmlActivity, MakecodeActivity, CodapActivity, EmbeddedActivity, SocroomActivity, AiRecommendQuizActivity"
        ),
      depth: z
        .number()
        .optional()
        .describe("활동 깊이, 1-indexed (1=메인, 2=하위, 3=하위의 하위). create 시 미지정이면 1"),
      tag_ids: z
        .array(z.string())
        .optional()
        .describe("연결할 태그 ID 목록"),
      branch_from: z
        .string()
        .optional()
        .describe(
          "갈림길 분기점 활동 ID. 지정 시 auto-chain 없이 활동만 생성됩니다. 생성 후 set_activity_branch로 분기를 설정하세요."
        ),
    },
    async ({
      action,
      material_id,
      activity_id,
      name,
      activity_type,
      depth,
      tag_ids,
      branch_from,
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
        if (!ACTIVITIABLE_TYPES.includes(activity_type)) {
          return {
            content: [
              {
                type: "text",
                text: `유효하지 않은 activity_type: ${activity_type}. 사용 가능: ${ACTIVITIABLE_TYPES.join(", ")}`,
              },
            ],
          };
        }

        // 1단계: activitiable 생성
        const endpoint = ACTIVITIABLE_ENDPOINTS[activity_type];
        const jsonapiType = pascalToSnake(activity_type);
        const activitiablePayload = {
          data: { type: jsonapiType, attributes: {} },
        };
        let activitiableId: string;
        try {
          const activitiableResponse = await client.request(
            "POST",
            endpoint,
            { json: activitiablePayload }
          );
          const activitiableData = (activitiableResponse.data as Record<string, unknown>) || {};
          activitiableId = String(activitiableData.id || "");
          if (!activitiableId) {
            return {
              content: [
                {
                  type: "text",
                  text: `activitiable(${activity_type}) 생성 실패: 응답에 id 없음.`,
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
                  text: `activitiable(${activity_type}) 생성 실패: ${e.detail}`,
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
          activitiable_type: activity_type,
          activitiable_id: activitiableId,
        };
        if (tag_ids?.length) attrs.tag_ids = tag_ids;

        const payload = buildJsonApiPayload("activities", attrs);
        const response = await client.createActivity(
          payload as Record<string, unknown>
        );
        const activity = extractSingle(response);
        const newId = String(activity.id);

        // 3단계: transition 생성
        let chainMsg = "";
        if (branch_from) {
          chainMsg = `. set_activity_branch로 갈림길 설정 필요 (branch_from=${branch_from})`;
        } else {
          try {
            const tail = await findTailActivity(material_id, newId);
            if (tail) {
              await createTransition(tail, newId);
              chainMsg = `, ${tail} → ${newId} 연결됨`;
            }
          } catch (e) {
            if (e instanceof CodleAPIError) {
              return {
                content: [
                  {
                    type: "text",
                    text: `transition 생성 실패: ${e.detail} (활동 [${newId}]은 생성됨)`,
                  },
                ],
              };
            }
            throw e;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `활동 생성 완료: [${newId}] ${activity.name} (type: ${activity_type}${chainMsg})`,
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

        if (!Object.keys(attrs).length) {
          return {
            content: [
              { type: "text", text: "수정할 항목이 없습니다." },
            ],
          };
        }

        const payload = buildJsonApiPayload("activities", attrs, activity_id);
        const response = await client.updateActivity(
          activity_id,
          payload as Record<string, unknown>
        );
        const activity = extractSingle(response);
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
    }
  );

  server.tool(
    "set_activity_branch",
    `갈림길 transition을 일괄 생성합니다.

manage_activities로 각 갈림길 활동을 생성한 후, 이 도구로 분기를 설정합니다.
do_many API를 사용하여 모든 branch transition을 한 번에 생성합니다
(Rails 검증 상 1개씩 생성은 불가능하며, 반드시 2개 이상을 동시 생성해야 합니다).`,
    {
      material_id: z.string().describe("자료 ID"),
      branch_from: z
        .string()
        .describe("분기점 활동 ID (이 활동에서 갈림길이 시작됨)"),
      mid_activity_id: z
        .string()
        .describe("기본 갈림길 활동 ID (필수)"),
      low_activity_id: z
        .string()
        .optional()
        .describe("보완 갈림길 활동 ID"),
      high_activity_id: z
        .string()
        .optional()
        .describe("정복 갈림길 활동 ID"),
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
      const included = (
        (matResp as Record<string, unknown>).included as Array<
          Record<string, unknown>
        >
      ) || [];
      const existingTransitions = included.filter(
        (i) => i.type === "activity_transition"
      );

      const dataToDestroy: { id: string }[] = [];
      for (const t of existingTransitions) {
        const attrs =
          (t.attributes as Record<string, unknown>) || {};
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
            text: `갈림길 설정 완료: ${branch_from} → ${levelsCreated.join(", ")}${destroyedMsg}`,
          },
        ],
      };
    }
  );
}
