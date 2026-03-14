import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { updateProblem } from "../../services/problem.service.js";

export default class ProblemUpdate extends BaseCommand {
  static override description = "문제를 수정합니다.";

  static override args = {
    id: Args.string({ description: "문제 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    title: Flags.string({ description: "문제 제목" }),
    content: Flags.string({ description: "문제 본문 (markdown)" }),
    "choices-json": Flags.string({
      description: '객관식 선택지 JSON. 예: \'[{"text":"O","isAnswer":true}]\'',
    }),
    "solutions-json": Flags.string({
      description: '주관식 정답 JSON 배열. 예: \'["42"]\'',
    }),
    "input-options-json": Flags.string({
      description: '주관식 옵션 JSON. 예: \'{"caseSensitive":true}\'',
    }),
    "tag-ids": Flags.string({ description: "태그 ID 목록 (쉼표 구분)" }),
    "is-public": Flags.boolean({ description: "공개 여부", allowNo: true }),
    commentary: Flags.string({ description: "해설" }),
    "sample-answer": Flags.string({ description: "모범답안" }),
    "descriptive-criterium-json": Flags.string({
      description: "서술형 채점기준 JSON",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProblemUpdate);
    const result = await updateProblem(this.client, {
      problem_id: args.id,
      title: flags.title,
      content: flags.content,
      choices: flags["choices-json"]
        ? JSON.parse(flags["choices-json"])
        : undefined,
      solutions: flags["solutions-json"]
        ? JSON.parse(flags["solutions-json"])
        : undefined,
      input_options: flags["input-options-json"]
        ? JSON.parse(flags["input-options-json"])
        : undefined,
      tag_ids: flags["tag-ids"]?.split(","),
      is_public: flags["is-public"],
      commentary: flags.commentary,
      sample_answer: flags["sample-answer"],
      descriptive_criterium: flags["descriptive-criterium-json"]
        ? JSON.parse(flags["descriptive-criterium-json"])
        : undefined,
    });
    this.outputResult(result.problem, () => result.text);
  }
}
