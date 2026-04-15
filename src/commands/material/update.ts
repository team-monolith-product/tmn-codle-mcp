import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractSingle, buildJsonApiPayload } from "../../api/models.js";
import {
  convertFromMarkdown,
  resolveLocalImages,
} from "../../lexical/index.js";

export default class MaterialUpdate extends BaseCommand {
  static description = "자료(Material)를 수정합니다.";

  static examples = [
    "<%= config.bin %> <%= command.id %> 123 --name '수정된 이름'",
    "<%= config.bin %> <%= command.id %> 123 --is-public",
    "<%= config.bin %> <%= command.id %> 123 --tag-ids ''  # 태그 전체 삭제",
  ];

  static args = {
    id: Args.string({ description: "자료 ID", required: true }),
  };

  static flags = {
    name: Flags.string({ description: "자료 이름" }),
    "is-public": Flags.boolean({
      description: "공개 여부",
      allowNo: true,
    }),
    "tag-ids": Flags.string({
      description: "태그 ID 목록 (쉼표 구분)",
      multiple: true,
    }),
    body: Flags.string({
      description:
        "자료 본문 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. 크기 지정: `![alt](src =WIDTHxHEIGHT)`",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MaterialUpdate);

    const attrs: Record<string, unknown> = {};
    if (flags.name !== undefined) attrs.name = flags.name;
    if (flags["is-public"] !== undefined) attrs.is_public = flags["is-public"];
    if (flags["tag-ids"] !== undefined) {
      // AIDEV-NOTE: --tag-ids "" (빈 문자열)은 태그 전체 삭제를 의미.
      // oclif multiple flag는 빈 배열을 표현할 수 없으므로 빈 문자열을 빈 배열로 변환.
      attrs.tag_ids = flags["tag-ids"].filter((id) => id !== "");
    }
    if (flags.body !== undefined) {
      const body = await resolveLocalImages(flags.body, this.client);
      attrs.body = convertFromMarkdown(body);
    }

    if (!Object.keys(attrs).length) {
      this.output({ message: "수정할 항목이 없습니다." });
      return;
    }

    const payload = buildJsonApiPayload("materials", attrs, args.id);
    const response = await this.client.updateMaterial(
      args.id,
      payload as Record<string, unknown>,
    );
    const mat = extractSingle(response);

    this.output(mat);
  }
}
