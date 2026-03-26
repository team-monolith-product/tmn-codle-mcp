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

  static examples = [
    '<%= config.bin %> <%= command.id %> --title \'OX 문제\' --type quiz --choices \'[{"text":"O","isAnswer":true},{"text":"X","isAnswer":false}]\'',
    "<%= config.bin %> <%= command.id %> --title '주관식' --type quiz --solutions '비지도학습'",
    "<%= config.bin %> <%= command.id %> --title '서술형' --type descriptive --content '설명하세요' --sample-answer '모범답안'",
    "<%= config.bin %> <%= command.id %> --title '활동지' --type sheet --content ':::short-answer{placeholder=\"답\"}\\n:::'",
  ];

  static flags = {
    title: Flags.string({ required: true, description: "문제 제목" }),
    type: Flags.string({
      required: true,
      description: "문제 유형",
      options: ["quiz", "sheet", "descriptive"],
    }),
    content: Flags.string({
      description:
        "문제 본문 (markdown). sheet 타입은 directive 문법 지원 — codle docs sheet-directives 참조",
    }),
    choices: Flags.string({
      description:
        "객관식 선택지 JSON [{text, isAnswer, imageUrl?, imageAlt?}]",
    }),
    solutions: Flags.string({ description: "주관식 정답", multiple: true }),
    "input-options": Flags.string({
      description: "주관식 옵션 JSON {caseSensitive?, placeholder?}",
    }),
    "tag-ids": Flags.string({ description: "태그 ID", multiple: true }),
    "is-public": Flags.boolean({ description: "공개 여부", allowNo: true }),
    commentary: Flags.string({ description: "해설" }),
    "sample-answer": Flags.string({
      description: "모범답안 (descriptive 타입)",
    }),
    criteria: Flags.string({
      description: "서술형 채점기준 JSON",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProblemCreate);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const choices: any = flags.choices
      ? this.parseJsonFlag("choices", flags.choices)
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputOptions: any = flags["input-options"]
      ? this.parseJsonFlag("input-options", flags["input-options"])
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const descriptiveCriterium: any = flags.criteria
      ? this.parseJsonFlag("criteria", flags.criteria)
      : undefined;

    let blocks: unknown | undefined;
    if (choices?.length) {
      blocks = buildSelectBlock(choices, flags.content);
    } else if (flags.solutions?.length) {
      blocks = buildInputBlock(flags.solutions, inputOptions, flags.content);
    } else if (flags.content !== undefined) {
      // AIDEV-NOTE: Rails Problem 모델은 모든 타입에서 blocks presence를 요구한다.
      // sheet/descriptive 타입은 choices/solutions가 없으므로 content를 Lexical로 변환하여 blocks에 넣는다.
      blocks = convertFromMarkdown(flags.content);
    }

    const attrs: Record<string, unknown> = {
      title: flags.title,
      problem_type: flags.type,
    };
    if (flags.content !== undefined) attrs.content = flags.content;
    if (blocks !== undefined) attrs.blocks = blocks;
    if (flags["tag-ids"] !== undefined) {
      // AIDEV-NOTE: --tag-ids "" (빈 문자열)은 태그 전체 삭제를 의미.
      // oclif multiple flag는 빈 배열을 표현할 수 없으므로 빈 문자열을 빈 배열로 변환.
      attrs.tag_ids = flags["tag-ids"].filter((id) => id !== "");
    }
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

    const result: Record<string, unknown> = { ...problem };
    if (warnings.length) result.warnings = warnings;
    this.output(result);
  }
}
