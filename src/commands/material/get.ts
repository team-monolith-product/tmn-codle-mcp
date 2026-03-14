import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getMaterialDetail } from "../../services/material.service.js";

export default class MaterialGet extends BaseCommand {
  static override description = "자료(Material)의 활동, 태그, 코스 흐름을 조회합니다.";

  static override args = {
    id: Args.string({ description: "조회할 자료의 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(MaterialGet);
    const result = await getMaterialDetail(this.client, args.id);
    this.outputResult(result.material, () => result.text);
  }
}
