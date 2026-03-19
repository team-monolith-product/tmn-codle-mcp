import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle, buildJsonApiPayload } from "../../api/models.js";
import { convertFromMarkdown } from "../../lexical/index.js";

export default class MaterialUpdate extends BaseCommand {
  static description = "자료(Material)를 수정합니다.";

  static flags = {
    "material-id": Flags.string({
      description: "수정할 자료 ID",
      required: true,
    }),
    name: Flags.string({ description: "자료 이름" }),
    "is-public": Flags.boolean({
      description: "공개 여부",
      allowNo: true,
    }),
    "tag-ids": Flags.string({
      description: "태그 ID 목록 (쉼표 구분)",
      multiple: true,
    }),
    body: Flags.string({ description: "자료 본문 (마크다운)" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialUpdate);

    const attrs: Record<string, unknown> = {};
    if (flags.name !== undefined) attrs.name = flags.name;
    if (flags["is-public"] !== undefined) attrs.is_public = flags["is-public"];
    if (flags["tag-ids"] !== undefined) attrs.tag_ids = flags["tag-ids"];
    if (flags.body !== undefined) attrs.body = convertFromMarkdown(flags.body);

    if (!Object.keys(attrs).length) {
      this.log("수정할 항목이 없습니다.");
      return;
    }

    const payload = buildJsonApiPayload(
      "materials",
      attrs,
      flags["material-id"],
    );
    const response = await this.client.updateMaterial(
      flags["material-id"],
      payload as Record<string, unknown>,
    );
    const mat = extractSingle(response);

    this.log(`자료 수정 완료: [${mat.id}] ${mat.name}`);
  }
}
