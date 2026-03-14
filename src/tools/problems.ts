import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import {
  createProblem,
  updateProblem,
  deleteProblem,
  syncProblemCollection,
} from "../services/problem.service.js";

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
        try {
          const result = await createProblem(client, {
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
          });
          return { content: [{ type: "text" as const, text: result.text }] };
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
        try {
          const result = await updateProblem(client, {
            problem_id,
            title,
            content,
            choices,
            solutions,
            input_options,
            tag_ids,
            is_public,
            commentary,
            sample_answer,
            descriptive_criterium,
          });
          return { content: [{ type: "text" as const, text: result.text }] };
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
          const result = await deleteProblem(client, problem_id);
          return { content: [{ type: "text" as const, text: result.text }] };
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
      try {
        const result = await syncProblemCollection(client, {
          activity_id,
          problems,
        });
        return { content: [{ type: "text" as const, text: result.text }] };
      } catch (e) {
        if (e instanceof CodleAPIError) {
          return {
            content: [
              { type: "text" as const, text: `PCP 설정 실패: ${e.detail}` },
            ],
          };
        }
        if (e instanceof Error) {
          return { content: [{ type: "text" as const, text: e.message }] };
        }
        throw e;
      }
    },
  );
}
