import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import {
  extractSingle,
  buildJsonApiPayload,
} from "../../api/models.js";
import { convertFromMarkdown } from "../../lexical/index.js";

export default class MaterialCreate extends BaseCommand {
  static description = "새 자료(Material)를 생성합니다.";

  static flags = {
    name: Flags.string({ description: "자료 이름", required: true }),
    "is-public": Flags.boolean({
      description: "공개 여부",
      default: false,
    }),
    "tag-ids": Flags.string({
      description: "태그 ID 목록 (쉼표 구분)",
      multiple: true,
    }),
    body: Flags.string({ description: "자료 본문 (마크다운)" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialCreate);

    const attrs: Record<string, unknown> = {
      name: flags.name,
      is_public: flags["is-public"] ?? false,
    };

    if (flags["tag-ids"]?.length) attrs.tag_ids = flags["tag-ids"];
    if (flags.body !== undefined) attrs.body = convertFromMarkdown(flags.body);

    const payload = buildJsonApiPayload("materials", attrs);
    const response = await this.client.createMaterial(
      payload as Record<string, unknown>,
    );
    const mat = extractSingle(response);

    this.log(`자료 생성 완료: [${mat.id}] ${mat.name}`);
  }
}
