import { Args, Flags } from "@oclif/core";

import { CodleAPIError } from "../../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";
import {
  buildInputBlock,
  buildSelectBlock,
  convertFromMarkdown,
  resolveLocalImages,
} from "../../lexical/index.js";

export default class ProblemUpdate extends BaseCommand {
  static description = "문제를 수정합니다.";

  static examples = [
    "<%= config.bin %> <%= command.id %> 789 --title '수정된 제목'",
    "<%= config.bin %> <%= command.id %> 789 --content '새 본문'",
  ];

  static args = {
    id: Args.string({ description: "문제 ID", required: true }),
  };

  static flags = {
    title: Flags.string({ description: "문제 제목" }),
    // AIDEV-NOTE: problem_type은 Rails에서 validates_immutable이므로 update 시 전송하면 422 에러.
    // create 전용 필드이므로 update 커맨드에서 제거.
    content: Flags.string({
      description:
        "문제 본문 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. 크기 지정: `![alt](src =WIDTHxHEIGHT)`. sheet 타입은 directive 문법 지원 — codle docs sheet-directives 참조",
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
        "해설 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. 크기 지정: `![alt](src =WIDTHxHEIGHT)`",
    }),
    "sample-answer": Flags.string({
      description: "모범답안 (descriptive 타입)",
    }),
    criteria: Flags.string({
      description: "서술형 채점기준 JSON",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProblemUpdate);
    const problemId = args.id;

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

    // AIDEV-NOTE: markdown 본문의 로컬 이미지 경로를 업로드한 뒤 blob URL로 치환. create와 동일 패턴.
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
      blocks = convertFromMarkdown(content);
    }

    const attrs: Record<string, unknown> = {};
    if (flags.title !== undefined) attrs.title = flags.title;
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

    const hasSideUpdates =
      flags["sample-answer"] !== undefined ||
      descriptiveCriterium !== undefined;
    if (!Object.keys(attrs).length && !hasSideUpdates) {
      this.output({ message: "수정할 항목이 없습니다." });
      return;
    }

    let problem: Record<string, unknown> = {};
    if (Object.keys(attrs).length) {
      const payload = buildJsonApiPayload("problems", attrs, problemId);
      const response = await this.client.updateProblem(
        problemId,
        payload as Record<string, unknown>,
      );
      problem = extractSingle(response);
    } else {
      const probResp = await this.client.request(
        "GET",
        `/api/v1/problems/${problemId}`,
      );
      const probData = (probResp.data as Record<string, unknown>) || {};
      problem = {
        id: String(probData.id || problemId),
        title: (probData.attributes as Record<string, unknown>)?.title,
      };
    }

    // AIDEV-NOTE: update 시에도 ProblemAnswer/DescriptiveCriterium을 upsert한다.
    // 기존 리소스가 있으면 update, 없으면 create.
    const warnings: string[] = [];
    if (flags["sample-answer"] !== undefined) {
      try {
        const paResp = await this.client.request(
          "GET",
          "/api/v1/problem_answers",
          { params: { "filter[problem_id]": problemId } },
        );
        const paList =
          (paResp.data as Array<Record<string, unknown>> | undefined) || [];
        if (paList.length > 0) {
          await this.client.doManyProblemAnswers({
            data_to_create: [],
            data_to_update: [
              {
                id: String(paList[0].id),
                attributes: { code: flags["sample-answer"] },
              },
            ],
            data_to_destroy: [],
          });
        } else {
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
        }
      } catch (e) {
        warnings.push(
          `모범답안 수정 실패: ${
            e instanceof CodleAPIError ? e.detail : String(e)
          }`,
        );
      }
    }
    if (descriptiveCriterium) {
      try {
        const probResp2 = await this.client.request(
          "GET",
          `/api/v1/problems/${problemId}`,
          { params: { include: "descriptive_criterium" } },
        );
        const included =
          ((probResp2 as Record<string, unknown>).included as Array<
            Record<string, unknown>
          >) || [];
        const existingDC = included.find(
          (i) => i.type === "descriptive_criterium",
        );
        const dcAttrs: Record<string, unknown> = {};
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
        if (existingDC) {
          await this.client.doManyDescriptiveCriteria({
            data_to_create: [],
            data_to_update: [
              {
                id: String(existingDC.id),
                attributes: dcAttrs,
              },
            ],
            data_to_destroy: [],
          });
        } else {
          dcAttrs.problem_id = problemId;
          await this.client.doManyDescriptiveCriteria({
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

    const result: Record<string, unknown> = { ...problem };
    if (warnings.length) result.warnings = warnings;
    this.output(result);
  }
}
