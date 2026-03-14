import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { updateMaterial } from "../../services/material.service.js";

export default class MaterialUpdate extends BaseCommand {
  static override description = "자료(Material)를 수정합니다.";

  static override args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({ description: "자료 이름 (최대 255자)" }),
    "is-public": Flags.boolean({ description: "공개 여부 (비가역)", allowNo: true }),
    "tag-ids": Flags.string({ description: "태그 ID 목록 (쉼표 구분)" }),
    body: Flags.string({ description: "자료 본문 (markdown)" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MaterialUpdate);
    const result = await updateMaterial(this.client, {
      material_id: args.id,
      name: flags.name,
      is_public: flags["is-public"],
      tag_ids: flags["tag-ids"]?.split(","),
      body: flags.body,
    });
    this.outputResult(result.material, () => result.text);
  }
}
