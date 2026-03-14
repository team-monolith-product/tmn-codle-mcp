import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { duplicateMaterial } from "../../services/material.service.js";

export default class MaterialDuplicate extends BaseCommand {
  static override description = "자료(Material)를 복제합니다.";

  static override args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(MaterialDuplicate);
    const result = await duplicateMaterial(this.client, args.id);
    this.outputResult(result.material, () => result.text);
  }
}
