import { Flags } from "@oclif/core";

import { CodleAPIError } from "../../api/errors.js";
import { buildJsonApiPayload, extractSingle } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";
import {
  buildInputBlock,
  buildSelectBlock,
  convertFromMarkdown,
} from "../../lexical/index.js";

export default class ProblemUpdate extends BaseCommand {
  static description = "문제를 수정합니다.";

  static flags = {
    "problem-id": Flags.string({
      required: true,
      description: "문제 ID",
    }),
    title: Flags.string({ description: "문제 제목" }),
    "problem-type": Flags.string({
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
    const { flags } = await this.parse(ProblemUpdate);

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
      blocks = convertFromMarkdown(flags.content);
    }

    const attrs: Record<string, unknown> = {};
    if (flags.title !== undefined) attrs.title = flags.title;
    if (flags["problem-type"] !== undefined)
      attrs.problem_type = flags["problem-type"];
    if (flags.content !== undefined) attrs.content = flags.content;
    if (blocks !== undefined) attrs.blocks = blocks;
    if (flags["tag-ids"]?.length) attrs.tag_ids = flags["tag-ids"];
    if (flags["is-public"] !== undefined) attrs.is_public = flags["is-public"];
    if (flags.commentary !== undefined)
      attrs.commentary = convertFromMarkdown(flags.commentary);

    const hasSideUpdates =
      flags["sample-answer"] !== undefined ||
      descriptiveCriterium !== undefined;
    if (!Object.keys(attrs).length && !hasSideUpdates) {
      this.log("수정할 항목이 없습니다.");
      return;
    }

    let problem: Record<string, unknown> = {};
    if (Object.keys(attrs).length) {
      const payload = buildJsonApiPayload(
        "problems",
        attrs,
        flags["problem-id"],
      );
      const response = await this.client.updateProblem(
        flags["problem-id"],
        payload as Record<string, unknown>,
      );
      problem = extractSingle(response);
    } else {
      const probResp = await this.client.request(
        "GET",
        `/api/v1/problems/${flags["problem-id"]}`,
      );
      const probData = (probResp.data as Record<string, unknown>) || {};
      problem = {
        id: String(probData.id || flags["problem-id"]),
        title: (probData.attributes as Record<string, unknown>)?.title,
      };
    }

    // AIDEV-NOTE: update 시에도 ProblemAnswer/DescriptiveCriterium을 upsert.
    const warnings: string[] = [];
    if (flags["sample-answer"] !== undefined) {
      try {
        const paResp = await this.client.request(
          "GET",
          "/api/v1/problem_answers",
          { params: { "filter[problem_id]": flags["problem-id"] } },
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
                  problem_id: flags["problem-id"],
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
          `/api/v1/problems/${flags["problem-id"]}`,
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
          dcAttrs.problem_id = flags["problem-id"];
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

    let resultText = `문제 수정 완료: [${problem.id}] ${problem.title}`;
    if (warnings.length) resultText += `\n⚠️ ${warnings.join("\n⚠️ ")}`;
    this.log(resultText);
  }
}
