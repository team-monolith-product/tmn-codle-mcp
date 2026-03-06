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
    "퀴즈/활동지에 연결할 문제 CRUD.",
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
      content: z.string().optional().describe("문제 설명 텍스트"),
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
          return {
            content: [
              {
                type: "text" as const,
                text: `문제 생성 완료: [${problem.id}] ${problem.title}`,
              },
            ],
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
          return {
            content: [
              {
                type: "text" as const,
                text: `문제 수정 완료: [${problem.id}] ${problem.title}`,
              },
            ],
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
    "Problem을 Activity의 ProblemCollection에 연결/해제/정렬.",
    {
      action: z.enum(["add", "remove", "reorder"]).describe("수행할 작업"),
      activity_id: z.string().describe("활동 ID"),
      problem_id: z
        .string()
        .optional()
        .describe("문제 ID (add, remove 시 필수)"),
      problem_ids: z
        .array(z.string())
        .optional()
        .describe("문제 ID 배열 (reorder 시 필수, 순서대로)"),
      position: z.number().optional().describe("위치 (add 시 선택)"),
      point: z.number().optional().describe("배점 (add 시 선택)"),
      is_required: z.boolean().optional().describe("필수 여부 (add 시 선택)"),
    },
    async ({
      action,
      activity_id,
      problem_id,
      problem_ids,
      position,
      point,
      is_required,
    }) => {
      // AIDEV-NOTE: /api/v1/problem_collections는 classroom_id가 필수라 자료 제작 단계에서 사용 불가.
      // AIDEV-NOTE: serializer가 lazy_load_data: true이므로 include 파라미터가 있어야 relationship data가 채워진다.
      // AIDEV-NOTE: controller의 jsonapi_include 화이트리스트는 "problem_collections.pcps"이므로 정확히 맞춰야 한다.
      let pcId: string;
      let existingPcps: Record<string, unknown>[];
      try {
        const actResp = await client.request(
          "GET",
          `/api/v1/activities/${activity_id}`,
          { params: { include: "problem_collections.pcps" } },
        );
        const actData = (actResp.data as Record<string, unknown>) || {};
        const rels = (actData.relationships as Record<string, unknown>) || {};
        const pcRel =
          (rels.problem_collections as Record<string, unknown>) || {};
        const pcRelData = pcRel.data as
          | Array<Record<string, unknown>>
          | undefined;
        if (!pcRelData?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `활동 ${activity_id}에 연결된 ProblemCollection이 없습니다.`,
              },
            ],
          };
        }
        pcId = String(pcRelData[0].id);

        // AIDEV-NOTE: PCP API는 do_many만 노출 (routes: only: []). create/delete/index 개별 라우트 없음.
        // included 배열에서 기존 PCP를 추출하고, 모든 조작을 do_many로 수행한다.
        const included =
          ((actResp as Record<string, unknown>).included as Array<
            Record<string, unknown>
          >) || [];
        existingPcps = included.filter(
          (i) => i.type === "problem_collections_problem",
        );
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `ProblemCollection 조회 실패: ${e.detail}`,
              },
            ],
          };
        }
        throw e;
      }

      if (action === "add") {
        if (!problem_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "add 시 problem_id는 필수입니다.",
              },
            ],
          };
        }

        const attrs: Record<string, unknown> = {
          problem_collection_id: pcId,
          problem_id,
        };
        if (position !== undefined) attrs.position = position;
        if (point !== undefined) attrs.point = point;
        if (is_required !== undefined) attrs.is_required = is_required;

        try {
          await client.doManyPCP({
            data_to_create: [{ attributes: attrs }],
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `문제 연결 완료: problem=${problem_id} → activity=${activity_id}`,
              },
            ],
          };
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `문제 연결 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
      }

      if (action === "remove") {
        if (!problem_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "remove 시 problem_id는 필수입니다.",
              },
            ],
          };
        }

        const targetPcp = existingPcps.find((pcp) => {
          const attrs = (pcp.attributes as Record<string, unknown>) || {};
          return String(attrs.problem_id) === String(problem_id);
        });

        if (!targetPcp) {
          return {
            content: [
              {
                type: "text" as const,
                text: `활동 ${activity_id}에서 문제 ${problem_id}를 찾을 수 없습니다.`,
              },
            ],
          };
        }

        try {
          await client.doManyPCP({
            data_to_destroy: [{ id: String(targetPcp.id) }],
          });
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `문제 연결 해제 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `문제 연결 해제 완료: problem=${problem_id} from activity=${activity_id}`,
            },
          ],
        };
      }

      if (action === "reorder") {
        if (!problem_ids?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: "reorder 시 problem_ids는 필수입니다.",
              },
            ],
          };
        }

        // problem_id → pcp_id 매핑 (included에서 추출)
        const problemToPcp: Record<string, string> = {};
        for (const pcp of existingPcps) {
          const attrs = (pcp.attributes as Record<string, unknown>) || {};
          problemToPcp[String(attrs.problem_id)] = String(pcp.id);
        }

        const dataToUpdate: Record<string, unknown>[] = [];
        for (let i = 0; i < problem_ids.length; i++) {
          const pcpId = problemToPcp[problem_ids[i]];
          if (pcpId) {
            dataToUpdate.push({
              id: pcpId,
              attributes: { position: i },
            });
          }
        }

        if (!dataToUpdate.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: "정렬할 문제가 없습니다.",
              },
            ],
          };
        }

        try {
          await client.doManyPCP({ data_to_update: dataToUpdate });
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `문제 정렬 실패: ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `문제 정렬 완료: ${problem_ids.join(
                " → ",
              )} (activity=${activity_id})`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `유효하지 않은 action: ${action}. add, remove, reorder 중 하나를 사용하세요.`,
          },
        ],
      };
    },
  );
}
