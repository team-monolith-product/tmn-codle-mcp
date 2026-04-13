import { Flags } from "@oclif/core";

import { CodleAPIError } from "../../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";
import {
  buildInputBlock,
  buildSelectBlock,
  convertFromMarkdown,
  resolveLocalImages,
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
        "문제 본문 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. sheet 타입은 directive 문법 지원 — codle docs sheet-directives 참조",
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
    commentary: Flags.string({
      description:
        "해설 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식",
    }),
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

    // AIDEV-NOTE: markdown 본문의 로컬 이미지(`![](file:///abs/path.png)`)를 업로드한 뒤 blob URL로 치환.
    // attrs.content(원본 markdown)와 blocks(Lexical JSON) 모두 같은 URL이 박히도록 변환 전에 수행한다.
    // 로컬 파일은 file:// URL로만 전달 가능하며, raw 경로·상대 경로는 resolveLocalImages가 거절한다.
    const content =
      flags.content !== undefined
        ? await resolveLocalImages(flags.content, this.client)
        : undefined;
    const commentary =
      flags.commentary !== undefined
        ? await resolveLocalImages(flags.commentary, this.client)
        : undefined;

    let blocks: unknown | undefined;
    if (choices?.length) {
      blocks = buildSelectBlock(choices, content);
    } else if (flags.solutions?.length) {
      blocks = buildInputBlock(flags.solutions, inputOptions, content);
    } else if (content !== undefined) {
      // AIDEV-NOTE: Rails Problem 모델은 모든 타입에서 blocks presence를 요구한다.
      // sheet/descriptive 타입은 choices/solutions가 없으므로 content를 Lexical로 변환하여 blocks에 넣는다.
      blocks = convertFromMarkdown(content);
    }

    const attrs: Record<string, unknown> = {
      title: flags.title,
      problem_type: flags.type,
    };
    if (content !== undefined) attrs.content = content;
    if (blocks !== undefined) attrs.blocks = blocks;
    if (flags["tag-ids"] !== undefined) {
      // AIDEV-NOTE: --tag-ids "" (빈 문자열)은 태그 전체 삭제를 의미.
      // oclif multiple flag는 빈 배열을 표현할 수 없으므로 빈 문자열을 빈 배열로 변환.
      attrs.tag_ids = flags["tag-ids"].filter((id) => id !== "");
    }
    if (flags["is-public"] !== undefined) attrs.is_public = flags["is-public"];
    // AIDEV-NOTE: commentary는 프론트엔드에서 Lexical JSON으로 렌더링하므로 문자열을 변환해야 한다.
    if (commentary !== undefined)
      attrs.commentary = convertFromMarkdown(commentary);

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
    // AIDEV-NOTE: FE(codle-react)는 descriptive 문제 생성 시 항상 descriptive_criterium 레코드를 생성한다.
    // criteria 없이 생성된 문제는 FE 에디터에서 null 참조 버그를 일으키므로,
    // CLI에서도 descriptive 타입이면 기본값으로 반드시 레코드를 생성한다.
    if (flags.type === "descriptive") {
      try {
        const dcAttrs: Record<string, unknown> = {
          problem_id: problemId,
          input_size: descriptiveCriterium?.input_size ?? 200,
          high_ratio: 1.0,
          mid_ratio: 0.7,
          low_ratio: 0.3,
        };
        if (descriptiveCriterium?.placeholder !== undefined)
          dcAttrs.placeholder = descriptiveCriterium.placeholder;
        if (descriptiveCriterium?.scoring_element !== undefined)
          dcAttrs.scoring_element = descriptiveCriterium.scoring_element;
        // AIDEV-NOTE: criteria 배열은 상/중/하 순서. API는 high/mid/low_content, high/mid/low_ratio 개별 필드.
        const [high, mid, low] = descriptiveCriterium?.criteria ?? [];
        if (high) {
          dcAttrs.high_content = high.content;
          if (high.ratio !== undefined) dcAttrs.high_ratio = high.ratio;
        }
        if (mid) {
          dcAttrs.mid_content = mid.content;
          if (mid.ratio !== undefined) dcAttrs.mid_ratio = mid.ratio;
        }
        if (low) {
          dcAttrs.low_content = low.content;
          if (low.ratio !== undefined) dcAttrs.low_ratio = low.ratio;
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
