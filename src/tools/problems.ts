import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodleAPIError } from "../api/errors.js";
import { client } from "../api/client.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
  formatProblemSummary,
} from "../api/models.js";

const VALID_PROBLEM_TYPES = ["judge", "quiz", "sheet", "descriptive"];

function buildDoManyCreatePayload(
  pcId: string,
  problemIds: string[]
): Record<string, unknown> {
  return {
    data_to_create: problemIds.map((pid, idx) => ({
      attributes: {
        problem_collection_id: pcId,
        problem_id: pid,
        position: idx,
        point: 1,
        is_required: true,
      },
    })),
  };
}

export function registerProblemTools(server: McpServer): void {
  server.tool(
    "search_problems",
    `문제(Problem)를 검색합니다.

기존 문제를 찾아 자료에 재활용하거나 참고할 수 있습니다.`,
    {
      query: z
        .string()
        .optional()
        .describe("검색 키워드 (문제 제목에서 검색)"),
      problem_type: z
        .string()
        .optional()
        .describe(
          '문제 유형 필터 ("judge", "quiz", "sheet", "descriptive")'
        ),
      tag_ids: z
        .array(z.string())
        .optional()
        .describe("필터링할 태그 ID 목록"),
      is_public: z.boolean().optional().describe("공개 여부 필터"),
      page_size: z
        .number()
        .default(20)
        .describe("페이지당 결과 수 (기본 20, 최대 100)"),
      page_number: z
        .number()
        .default(1)
        .describe("페이지 번호 (1부터 시작)"),
    },
    async ({ query, problem_type, tag_ids, is_public, page_size, page_number }) => {
      const params: Record<string, string | number> = {
        "page[size]": Math.min(page_size, 100),
        "page[number]": page_number,
        "filter[is_exam]": "false",
      };
      if (query) params["filter[query]"] = query;
      if (problem_type && VALID_PROBLEM_TYPES.includes(problem_type)) {
        params["filter[problem_type]"] = problem_type;
      }
      if (is_public !== undefined) {
        params["filter[is_public]"] = String(is_public);
      }
      if (tag_ids?.length) {
        params["filter[tag_ids]"] = tag_ids.join(",");
      }

      const response = await client.listProblems(params);
      const problems = extractList(response);

      if (!problems.length) {
        return { content: [{ type: "text", text: "검색 결과가 없습니다." }] };
      }

      const lines = [`문제 검색 결과 (${problems.length}건):`];
      for (const p of problems) {
        lines.push(formatProblemSummary(p));
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "upsert_problem",
    `문제(Problem)를 생성하거나 수정합니다.

problem_id를 지정하면 기존 문제를 수정하고, 생략하면 새 문제를 생성합니다.
user_id는 인증된 사용자로 자동 설정됩니다.

## 제약 사항
- title에 \`/\` 기호 사용 불가 (예: \`[O/X]\` → \`[OX]\`로 변경)
- blocks는 필수. content는 검색용 평문이며, 렌더링은 blocks 기준

## blocks 형식 (quiz 타입)
\`\`\`json
{
  "root": { "children": [{"type": "paragraph", "children": [{"text": "문제 본문"}]}] },
  "quiz": {
    "quizType": "ox | multipleChoice | shortAnswer",
    "answer": "O 또는 X (ox) | 0부터 시작하는 인덱스 (multipleChoice) | 정답 텍스트 (shortAnswer)",
    "choices": ["선택지1", "선택지2", ...],
    "commentary": "해설 텍스트"
  }
}
\`\`\`
- OX: \`quizType="ox"\`, \`answer="O"\` 또는 \`"X"\`
- 객관식: \`quizType="multipleChoice"\`, \`answer=0\`(첫번째 선택지), \`choices=[...]\`
- 주관식: \`quizType="shortAnswer"\`, \`answer="정답"\`

## blocks 형식 (sheet/descriptive 타입)
\`\`\`json
{
  "root": { "children": [{"type": "paragraph", "children": [{"text": "문제 본문"}]}] }
}
\`\`\`
sheet/descriptive 타입은 quiz 객체 없이 root만 포함합니다.

## 문제 타입 선택 가이드
- quiz: OX, 객관식, 주관식 — 정답이 있는 퀴즈 (blocks에 quiz 객체 필수)
- sheet: 활동지 문항 — 자유 작성형 (SheetActivity용)
- descriptive: 서술형 — 자유 작성형, 정답 일치 채점 아님 (QuizActivity에서 서술형 문항)
- judge: 코딩 문제

**주의**: 스크립트에서 [서술형]으로 표기된 문제는 quiz/shortAnswer가 아닌 descriptive를 사용하세요.`,
    {
      title: z
        .string()
        .describe("문제 제목 (필수, 최대 255자, `/` 기호 사용 불가)"),
      problem_type: z
        .string()
        .describe(
          '문제 유형 (필수, "judge"=코딩, "quiz"=퀴즈, "sheet"=시트, "descriptive"=서술형)'
        ),
      problem_id: z
        .string()
        .optional()
        .describe("수정할 문제의 ID (생략 시 새로 생성)"),
      content: z
        .string()
        .optional()
        .describe("문제 본문 텍스트 (검색용 평문)"),
      blocks: z
        .record(z.unknown())
        .optional()
        .describe("문제 본문 (Lexical 에디터 JSON 형식, 필수)"),
      is_public: z
        .boolean()
        .default(false)
        .describe("공개 여부 (기본 False)"),
      timeout: z
        .number()
        .default(1)
        .describe("실행 제한 시간(초) - judge 타입에서 사용 (기본 1)"),
      skeleton_code: z
        .string()
        .optional()
        .describe("기본 제공 코드 - judge 타입에서 사용"),
      tag_ids: z
        .array(z.string())
        .optional()
        .describe("연결할 태그 ID 목록"),
      commentary: z
        .union([z.record(z.unknown()), z.string()])
        .optional()
        .describe("문제 해설 (Lexical 에디터 JSON 형식)"),
    },
    async ({
      title,
      problem_type,
      problem_id,
      content,
      blocks,
      is_public,
      timeout,
      skeleton_code,
      tag_ids,
      commentary,
    }) => {
      if (!VALID_PROBLEM_TYPES.includes(problem_type)) {
        return {
          content: [
            {
              type: "text",
              text: `유효하지 않은 problem_type: ${problem_type}. ${VALID_PROBLEM_TYPES.join(", ")} 중 하나를 사용하세요.`,
            },
          ],
        };
      }
      if (title.includes("/")) {
        return {
          content: [
            {
              type: "text",
              text: `제목에 \`/\` 기호를 사용할 수 없습니다. 현재 제목: ${title}`,
            },
          ],
        };
      }
      if (!blocks && !problem_id) {
        return {
          content: [
            {
              type: "text",
              text: "blocks는 필수입니다. Lexical 에디터 JSON 형식으로 문제 본문을 제공하세요.",
            },
          ],
        };
      }

      const attrs: Record<string, unknown> = { title };
      if (!problem_id) {
        attrs.problem_type = problem_type;
      }
      if (content !== undefined) attrs.content = content;
      if (blocks !== undefined) attrs.blocks = blocks;
      attrs.is_public = is_public;
      attrs.timeout = timeout;
      if (skeleton_code !== undefined) attrs.skeleton_code = skeleton_code;
      if (tag_ids !== undefined) attrs.tag_ids = tag_ids;
      if (commentary !== undefined) {
        if (typeof commentary === "string") {
          try {
            attrs.commentary = JSON.parse(commentary);
          } catch {
            attrs.commentary = commentary;
          }
        } else {
          attrs.commentary = commentary;
        }
      }

      const payload = buildJsonApiPayload("problems", attrs, problem_id);

      if (problem_id) {
        const response = await client.updateProblem(
          problem_id,
          payload as Record<string, unknown>
        );
        const problem = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `문제 수정 완료: [${problem.id}] ${problem.title}`,
            },
          ],
        };
      } else {
        const response = await client.createProblem(
          payload as Record<string, unknown>
        );
        const problem = extractSingle(response);
        return {
          content: [
            {
              type: "text",
              text: `문제 생성 완료: [${problem.id}] ${problem.title} (type: ${problem_type})`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "manage_problem_collections",
    `활동(Activity)의 ProblemCollection에 문제를 연결합니다.

QuizActivity, SheetActivity 등 문제를 포함하는 활동에 사용합니다.
활동 생성 후 이 도구로 문제를 연결해야 학생에게 문제가 표시됩니다.

## 중요: ProblemCollection은 자동 생성됨
Rails가 QuizActivity/SheetActivity 타입의 Activity를 생성할 때
ProblemCollection을 자동으로 생성합니다. 따라서 별도 생성이 불필요합니다.

## 워크플로우
1. manage_activities(action="create")로 활동 생성 (ProblemCollection 자동 생성됨)
2. upsert_problem으로 문제 생성 → problem_id 획득
3. manage_problem_collections(action="create", activity_id=..., problem_ids=[...])
   → 자동 생성된 ProblemCollection을 찾아 문제를 연결

## 동작 방식
- create: activity_id로 자동 생성된 ProblemCollection을 찾아 문제 연결
- add_problems: 기존 ProblemCollection에 문제 추가 (problem_collection_id 직접 지정)`,
    {
      action: z
        .string()
        .describe('수행할 작업 ("create", "add_problems")'),
      activity_id: z
        .string()
        .optional()
        .describe("활동 ID (create 시 필수)"),
      problem_ids: z
        .array(z.string())
        .optional()
        .describe("연결할 문제 ID 목록 (create, add_problems 시 필수)"),
      problem_collection_id: z
        .string()
        .optional()
        .describe("ProblemCollection ID (add_problems 시 필수)"),
    },
    async ({ action, activity_id, problem_ids, problem_collection_id }) => {
      if (action === "create") {
        if (!activity_id) {
          return {
            content: [
              {
                type: "text",
                text: "create 시 activity_id는 필수입니다.",
              },
            ],
          };
        }
        if (!problem_ids?.length) {
          return {
            content: [
              {
                type: "text",
                text: "create 시 problem_ids는 필수입니다.",
              },
            ],
          };
        }

        let actResp: Record<string, unknown>;
        try {
          actResp = await client.getActivity(activity_id, {
            include: "problem_collections.pcps",
          });
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text",
                  text: `활동 조회 실패 (activity_id=${activity_id}): ${e.detail}`,
                },
              ],
            };
          }
          throw e;
        }

        const data = actResp.data as Record<string, unknown>;
        const relationships = (data?.relationships as Record<string, unknown>) || {};
        const pcRel = (relationships.problem_collections as Record<string, unknown>) || {};
        const pcData = pcRel.data as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | undefined;

        if (!pcData || (Array.isArray(pcData) && !pcData.length)) {
          return {
            content: [
              {
                type: "text",
                text: `활동 [${activity_id}]에 ProblemCollection이 없습니다. QuizActivity 또는 SheetActivity 타입의 활동인지 확인하세요.`,
              },
            ],
          };
        }

        const pcId = Array.isArray(pcData)
          ? String(pcData[0].id)
          : String(pcData.id);

        const doManyPayload = buildDoManyCreatePayload(pcId, problem_ids);
        try {
          await client.doManyProblemCollectionsProblems(doManyPayload);
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                {
                  type: "text",
                  text: `ProblemCollection [${pcId}] 발견됨, 문제 연결 실패: ${e.detail}. add_problems로 재시도하세요.`,
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
              text: `ProblemCollection 생성 및 문제 연결 완료: [${pcId}] (활동: ${activity_id}, 문제 ${problem_ids.length}개 연결)`,
            },
          ],
        };
      }

      if (action === "add_problems") {
        if (!problem_collection_id) {
          return {
            content: [
              {
                type: "text",
                text: "add_problems 시 problem_collection_id는 필수입니다.",
              },
            ],
          };
        }
        if (!problem_ids?.length) {
          return {
            content: [
              {
                type: "text",
                text: "add_problems 시 problem_ids는 필수입니다.",
              },
            ],
          };
        }

        const doManyPayload = buildDoManyCreatePayload(
          problem_collection_id,
          problem_ids
        );
        try {
          await client.doManyProblemCollectionsProblems(doManyPayload);
        } catch (e) {
          if (e instanceof CodleAPIError) {
            return {
              content: [
                { type: "text", text: `문제 연결 실패: ${e.detail}` },
              ],
            };
          }
          throw e;
        }

        return {
          content: [
            {
              type: "text",
              text: `문제 연결 완료: ProblemCollection [${problem_collection_id}]에 문제 ${problem_ids.length}개 추가`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `유효하지 않은 action: ${action}. create, add_problems 중 하나를 사용하세요.`,
          },
        ],
      };
    }
  );
}
