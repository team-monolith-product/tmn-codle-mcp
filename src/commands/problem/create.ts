import { Flags } from "@oclif/core";

import { CodleAPIError } from "../../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";
import {
  buildInputBlock,
  buildSelectBlock,
  convertFromMarkdown,
} from "../../lexical/index.js";

export default class ProblemCreate extends BaseCommand {
  static description = "문제를 생성합니다.";

  static flags = {
    title: Flags.string({ required: true, description: "문제 제목" }),
    "problem-type": Flags.string({
      required: true,
      description: "문제 유형",
      options: ["quiz", "sheet", "descriptive"],
    }),
    content: Flags.string({ description: "문제 본문 (markdown)" }),
    choices: Flags.string({
      description:
        "객관식 선택지 JSON [{text, isAnswer, imageUrl?, imageAlt?}]",
    }),
    solutions: Flags.string({ description: "주관식 정답", multiple: true }),
    "input-options": Flags.string({
      description: "주관식 옵션 JSON {caseSensitive?, placeholder?}",
    }),
    "tag-ids": Flags.string({ description: "태그 ID", multiple: true }),
    "is-public": Flags.boolean({ description: "공개 여부" }),
    commentary: Flags.string({ description: "해설" }),
    "sample-answer": Flags.string({
      description: "모범답안 (descriptive 타입)",
    }),
    "descriptive-criterium": Flags.string({
      description: "서술형 채점기준 JSON",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProblemCreate);

    const choices = flags.choices ? JSON.parse(flags.choices) : undefined;
    const inputOptions = flags["input-options"]
      ? JSON.parse(flags["input-options"])
      : undefined;
    const descriptiveCriterium = flags["descriptive-criterium"]
      ? JSON.parse(flags["descriptive-criterium"])
      : undefined;

    let blocks: unknown | undefined;
    if (choices?.length) {
      blocks = buildSelectBlock(choices, flags.content);
    } else if (flags.solutions?.length) {
      blocks = buildInputBlock(flags.solutions, inputOptions, flags.content);
    } else if (flags.content !== undefined) {
      // AIDEV-NOTE: Rails Problem 모델은 모든 타입에서 blocks presence를 요구한다.
      blocks = convertFromMarkdown(flags.content);
    }

    const attrs: Record<string, unknown> = {
      title: flags.title,
      problem_type: flags["problem-type"],
    };
    if (flags.content !== undefined) attrs.content = flags.content;
    if (blocks !== undefined) attrs.blocks = blocks;
    if (flags["tag-ids"]?.length) attrs.tag_ids = flags["tag-ids"];
    if (flags["is-public"] !== undefined) attrs.is_public = flags["is-public"];
    // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
    if (flags.commentary !== undefined)
      attrs.commentary = convertFromMarkdown(flags.commentary);

    const payload = buildJsonApiPayload("problems", attrs);
    const response = await this.client.createProblem(
      payload as Record<string, unknown>,
    );
    const problem = extractSingle(response);
    const problemId = String(problem.id);

    const warnings: string[] = [];
    if (flags["sample-answer"] !== undefined) {
      try {
        await this.client.doManyProblemAnswers({
          data_to_create: [
            {
              attributes: {
                code: flags["sample-answer"],
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
    if (descriptiveCriterium) {
      try {
        const dcAttrs: Record<string, unknown> = {
          problem_id: problemId,
        };
        if (descriptiveCriterium.input_size !== undefined)
          dcAttrs.input_size = descriptiveCriterium.input_size;
        if (descriptiveCriterium.placeholder !== undefined)
          dcAttrs.placeholder = descriptiveCriterium.placeholder;
        if (descriptiveCriterium.scoring_element !== undefined)
          dcAttrs.scoring_element = descriptiveCriterium.scoring_element;
        // AIDEV-NOTE: criteria 배열은 상/중/하 순서. API는 high/mid/low_content, high/mid/low_ratio 개별 필드.
        const [high, mid, low] = descriptiveCriterium.criteria ?? [];
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
        await this.client.doManyDescriptiveCriteria({
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
    this.log(resultText);
  }
}
