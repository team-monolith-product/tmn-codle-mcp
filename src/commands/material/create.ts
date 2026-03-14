import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { createMaterial } from "../../services/material.service.js";

export default class MaterialCreate extends BaseCommand {
  static override description = "자료(Material)를 생성합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({ description: "자료 이름 (최대 255자)", required: true }),
    "is-public": Flags.boolean({ description: "공개 여부" }),
    "tag-ids": Flags.string({ description: "태그 ID 목록 (쉼표 구분)" }),
    body: Flags.string({ description: "자료 본문 (markdown)" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialCreate);
    const result = await createMaterial(this.client, {
      name: flags.name,
      is_public: flags["is-public"],
      tag_ids: flags["tag-ids"]?.split(","),
      body: flags.body,
    });
    this.outputResult(result.material, () => result.text);
  }
}
