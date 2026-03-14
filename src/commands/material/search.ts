import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { searchMaterials } from "../../services/material.service.js";

export default class MaterialSearch extends BaseCommand {
  static override description = "자료(Material)를 검색합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    query: Flags.string({ description: "검색 키워드 (자료 이름에서 검색)" }),
    "tag-ids": Flags.string({ description: "필터링할 태그 ID 목록 (쉼표 구분)" }),
    "is-public": Flags.boolean({ description: "공개 여부 필터 (공개 자료 검색)", allowNo: true }),
    "page-size": Flags.integer({ description: "페이지당 결과 수", default: 20 }),
    "page-number": Flags.integer({ description: "페이지 번호 (1부터 시작)", default: 1 }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialSearch);
    const result = await searchMaterials(this.client, {
      query: flags.query,
      tag_ids: flags["tag-ids"]?.split(","),
      is_public: flags["is-public"],
      page_size: flags["page-size"],
      page_number: flags["page-number"],
    });
    this.outputResult(result.materials, () => result.text);
  }
}
