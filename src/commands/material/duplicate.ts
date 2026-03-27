import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle } from "../../api/models.js";

export default class MaterialDuplicate extends BaseCommand {
  static description = "자료(Material)를 복제합니다.";

  static examples = ["<%= config.bin %> <%= command.id %> 123"];

  static args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(MaterialDuplicate);

    const response = await this.client.duplicateMaterial(args.id);
    const mat = extractSingle(response);

    this.output(mat);
  }
}
