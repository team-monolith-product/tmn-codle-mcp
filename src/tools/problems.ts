import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import { buildJsonApiPayload, extractSingle } from "../api/models.js";
import {
  buildSelectBlock,
  buildInputBlock,
  convertFromMarkdown,
} from "../lexical/index.js";

export function registerProblemTools(server: McpServer): void {
  server.tool(
    "manage_problems",
    "문제 CRUD. 활동에 연결하려면 manage_problem_collection_problems를 사용.",
    {
      action: z.enum(["create", "update", "delete"]).describe("수행할 작업"),
      problem_id: z
        .string()
        .optional()
        .describe("문제 ID (update, delete 시 필수)"),
      title: z.string().optional().describe("문제 제목 (create 시 필수)"),
      problem_type: z
        .enum(["quiz", "sheet", "descriptive"])
        .optional()
        .describe("문제 유형 (create 시 필수)"),
      content: z
        .string()
        .optional()
        .describe(
          "문제 본문 (markdown). 활동지(sheet) 입력란은 directive 문법 지원 — codle://docs/sheet-directives 참조",
        ),
      choices: z
        .array(
          z.object({
            text: z.string(),
            isAnswer: z.boolean(),
            imageUrl: z.string().optional(),
            imageAlt: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "객관식 선택지 (quiz 타입). [{text, isAnswer, imageUrl?, imageAlt?}]",
        ),
      solutions: z
        .array(z.string())
        .optional()
        .describe("주관식 정답 목록 (quiz 타입)"),
      input_options: z
        .object({
          caseSensitive: z.boolean().optional(),
          placeholder: z.string().optional(),
        })
        .optional()
        .describe("주관식 옵션 (caseSensitive, placeholder)"),
      tag_ids: z.array(z.string()).optional().describe("태그 ID 목록"),
      is_public: z.boolean().optional().describe("공개 여부"),
      commentary: z.string().optional().describe("해설"),
      sample_answer: z
        .string()
        .optional()
        .describe("모범답안 (descriptive 타입)"),
      descriptive_criterium: z
        .object({
          input_size: z
            .number()
            .optional()
            .describe("입력칸 크기 (100, 200, 400)"),
          placeholder: z.string().optional().describe("입력칸 자리표시자"),
          scoring_element: z.string().optional().describe("평가 요소"),
          criteria: z
            .array(z.object({ content: z.string(), ratio: z.number() }))
            .optional()
            .describe(
              "채점기준 상/중/하 순서. [{content, ratio(0~1)}] 예: 1.0, 0.7, 0.3",
            ),
        })
        .optional()
        .describe("서술형 채점기준 (descriptive 타입)"),
    },
    async ({
      action,
      problem_id,
      title,
      problem_type,
      content,
      choices,
      solutions,
      input_options,
      tag_ids,
      is_public,
      commentary,
      sample_answer,
      descriptive_criterium,
    }) => {
      if (action === "create") {
        if (!title || !problem_type) {
          return {
            content: [
              {
                type: "text" as const,
                text: "create 시 title, problem_type은 필수입니다.",
              },
            ],
          };
        }

        let blocks: unknown | undefined;
        if (choices?.length) {
          blocks = buildSelectBlock(choices, content);
        } else if (solutions?.length) {
          blocks = buildInputBlock(solutions, input_options, content);
        } else if (content !== undefined) {
          // AIDEV-NOTE: Rails Problem 모델은 모든 타입에서 blocks presence를 요구한다.
          // sheet/descriptive 타입은 choices/solutions가 없으므로 content를 Lexical로 변환하여 blocks에 넣는다.
          blocks = convertFromMarkdown(content);
        }

        const attrs: Record<string, unknown> = {
          title,
          problem_type,
        };
        if (content !== undefined) attrs.content = content;
        if (blocks !== undefined) attrs.blocks = blocks;
        if (tag_ids?.length) attrs.tag_ids = tag_ids;
        if (is_public !== undefined) attrs.is_public = is_public;
        // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
        if (commentary !== undefined)
          attrs.commentary = convertFromMarkdown(commentary);

        const payload = buildJsonApiPayload("problems", attrs);
        try {
          const response = await client.createProblem(
            payload as Record<string, unknown>,
          );
          const problem = extractSingle(response);
          const problemId = String(problem.id);

          const warnings: string[] = [];
          if (sample_answer !== undefined) {
            try {
              await client.doManyProblemAnswers({
                data_to_create: [
                  {
                    attributes: {
                      code: sample_answer,
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
          if (descriptive_criterium) {
            try {
              const dcAttrs: Record<string, unknown> = {
                problem_id: problemId,
              };
              if (descriptive_criterium.input_size !== undefined)
                dcAttrs.input_size = descriptive_criterium.input_size;
              if (descriptive_criterium.placeholder !== undefined)
                dcAttrs.placeholder = descriptive_criterium.placeholder;
              if (descriptive_criterium.scoring_element !== undefined)
                dcAttrs.scoring_element = descriptive_criterium.scoring_element;
              // AIDEV-NOTE: criteria 배열은 상/중/하 순서. API는 high/mid/low_content, high/mid/low_ratio 개별 필드.
              const [high, mid, low] = descriptive_criterium.criteria ?? [];
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
              await client.doManyDescriptiveCriteria({
                data_to_create: [{ attributes: dcAttrs }],
                data_to_update: [],
                data_to_destroy: [],
              });
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
          return {
            content: [{ type: "text" as const, text: resultText }],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                { type: "text" as const, text: `문제 생성 실패: ${e.detail}` },
              ],
            };
          }
          throw e;
        }
      }

      if (action === "update") {
        if (!problem_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "update 시 problem_id는 필수입니다.",
              },
            ],
          };
        }

        let blocks: unknown | undefined;
        if (choices?.length) {
          blocks = buildSelectBlock(choices, content);
        } else if (solutions?.length) {
          blocks = buildInputBlock(solutions, input_options, content);
        } else if (content !== undefined) {
          blocks = convertFromMarkdown(content);
        }

        const attrs: Record<string, unknown> = {};
        if (title !== undefined) attrs.title = title;
        if (content !== undefined) attrs.content = content;
        if (blocks !== undefined) attrs.blocks = blocks;
        if (tag_ids !== undefined) attrs.tag_ids = tag_ids;
        if (is_public !== undefined) attrs.is_public = is_public;
        // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
        if (commentary !== undefined)
          attrs.commentary = convertFromMarkdown(commentary);

        if (!Object.keys(attrs).length) {
          return {
            content: [
              { type: "text" as const, text: "수정할 항목이 없습니다." },
            ],
          };
        }

        const payload = buildJsonApiPayload("problems", attrs, problem_id);
        try {
          const response = await client.updateProblem(
            problem_id,
            payload as Record<string, unknown>,
          );
          const problem = extractSingle(response);

          // AIDEV-NOTE: update 시에도 ProblemAnswer/DescriptiveCriterium을 upsert한다.
          // 기존 리소스가 있으면 update, 없으면 create.
          const warnings: string[] = [];
          if (sample_answer !== undefined) {
            try {
              const paResp = await client.request(
                "GET",
                "/api/v1/problem_answers",
                { params: { "filter[problem_id]": problem_id } },
              );
              const paList =
                (paResp.data as Array<Record<string, unknown>> | undefined) ||
                [];
              if (paList.length > 0) {
                await client.doManyProblemAnswers({
                  data_to_create: [],
                  data_to_update: [
                    {
                      id: String(paList[0].id),
                      attributes: { code: sample_answer },
                    },
                  ],
                  data_to_destroy: [],
                });
              } else {
                await client.doManyProblemAnswers({
                  data_to_create: [
                    {
                      attributes: {
                        code: sample_answer,
                        problem_id,
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
          if (descriptive_criterium) {
            try {
              const probResp = await client.request(
                "GET",
                `/api/v1/problems/${problem_id}`,
                { params: { include: "descriptive_criterium" } },
              );
              const included =
                ((probResp as Record<string, unknown>).included as Array<
                  Record<string, unknown>
                >) || [];
              const existingDC = included.find(
                (i) => i.type === "descriptive_criterium",
              );
              const dcAttrs: Record<string, unknown> = {};
              if (descriptive_criterium.input_size !== undefined)
                dcAttrs.input_size = descriptive_criterium.input_size;
              if (descriptive_criterium.placeholder !== undefined)
                dcAttrs.placeholder = descriptive_criterium.placeholder;
              if (descriptive_criterium.scoring_element !== undefined)
                dcAttrs.scoring_element = descriptive_criterium.scoring_element;
              const [high, mid, low] = descriptive_criterium.criteria ?? [];
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
              if (existingDC) {
                await client.doManyDescriptiveCriteria({
                  data_to_create: [],
                  data_to_update: [
                    { id: String(existingDC.id), attributes: dcAttrs },
                  ],
                  data_to_destroy: [],
                });
              } else {
                dcAttrs.problem_id = problem_id;
                await client.doManyDescriptiveCriteria({
                  data_to_create: [{ attributes: dcAttrs }],
                  data_to_update: [],
                  data_to_destroy: [],
                });
              }
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
          return {
            content: [{ type: "text" as const, text: resultText }],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                { type: "text" as const, text: `문제 수정 실패: ${e.detail}` },
              ],
            };
          }
          throw e;
        }
      }

      if (action === "delete") {
        if (!problem_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "delete 시 problem_id는 필수입니다.",
              },
            ],
          };
        }
        try {
          await client.deleteProblem(problem_id);
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                { type: "text" as const, text: `문제 삭제 실패: ${e.detail}` },
              ],
            };
          }
          throw e;
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `문제 삭제 완료: ${problem_id}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `유효하지 않은 action: ${action}. create, update, delete 중 하나를 사용하세요.`,
          },
        ],
      };
    },
  );

  server.tool(
    "manage_problem_collection_problems",
    "활동의 문제 목록을 선언적으로 설정. problems 순서가 최종 상태.",
    {
      activity_id: z.string().describe("활동 ID"),
      problems: z
        .array(
          z.object({
            id: z.string().describe("문제 ID"),
            point: z
              .number()
              .optional()
              .describe("배점 (기본 1). 0이면 채점 안 함."),
          }),
        )
        .describe("최종 문제 목록 (순서대로). 빈 배열이면 전체 제거."),
    },
    async ({ activity_id, problems }) => {
      let state: ActivityPcpState;
      try {
        state = await getActivityPcpState(activity_id);
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                e instanceof Error ? e.message : `활동 조회 실패: ${String(e)}`,
            },
          ],
        };
      }

      const { pcId, existingPcps } = state;

      // Build lookup of existing PCPs by problem_id
      const existingByProblemId = new Map(
        existingPcps.map((pcp) => [pcp.problemId, pcp]),
      );

      const dataToCreate: Array<Record<string, unknown>> = [];
      const dataToUpdate: Array<Record<string, unknown>> = [];
      const dataToDestroy: Array<Record<string, unknown>> = [];

      const desiredSet = new Set(problems.map((p) => p.id));

      for (let i = 0; i < problems.length; i++) {
        const { id: problemId, point } = problems[i];
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

      // Remove PCPs not in desired set
      for (const pcp of existingPcps) {
        if (!desiredSet.has(pcp.problemId)) {
          dataToDestroy.push({ id: pcp.id });
        }
      }

      // Skip API call if nothing to do
      if (
        !dataToCreate.length &&
        !dataToUpdate.length &&
        !dataToDestroy.length
      ) {
        return {
          content: [{ type: "text" as const, text: "변경 사항 없음." }],
        };
      }

      try {
        await client.doManyPCP({
          data_to_create: dataToCreate,
          data_to_update: dataToUpdate,
          data_to_destroy: dataToDestroy,
        });
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `PCP 설정 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      const parts: string[] = [];
      if (dataToCreate.length) parts.push(`추가 ${dataToCreate.length}`);
      if (dataToUpdate.length) parts.push(`변경 ${dataToUpdate.length}`);
      if (dataToDestroy.length) parts.push(`제거 ${dataToDestroy.length}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `PCP 설정 완료 (${parts.join(", ")}). 최종 문제 수: ${
              problems.length
            }`,
          },
        ],
      };
    },
  );
}

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
