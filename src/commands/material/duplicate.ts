import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle } from "../../api/models.js";

export default class MaterialDuplicate extends BaseCommand {
  static description = "자료(Material)를 복제합니다.";

  static flags = {
    "material-id": Flags.string({
      description: "복제할 원본 자료 ID",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialDuplicate);

    const response = await this.client.duplicateMaterial(flags["material-id"]);
    const mat = extractSingle(response);

    this.log(
      `자료 복제 완료: [${mat.id}] ${mat.name} (원본: ${flags["material-id"]})`,
    );
  }
}
