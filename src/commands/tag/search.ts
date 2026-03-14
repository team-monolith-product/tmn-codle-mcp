import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { searchTags } from "../../services/tag.service.js";

export default class TagSearch extends BaseCommand {
  static override description = "태그(Tag)를 검색합니다.";

  static override flags = {
    ...BaseCommand.baseFlags,
    domain: Flags.string({
      description: "태그 도메인 (material, problem, difficulty 등)",
    }),
    query: Flags.string({ description: "태그 이름 검색 키워드" }),
    "page-size": Flags.integer({ description: "페이지당 결과 수", default: 50 }),
    "page-number": Flags.integer({ description: "페이지 번호 (1부터 시작)", default: 1 }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TagSearch);
    const result = await searchTags(this.client, {
      domain: flags.domain,
      query: flags.query,
      page_size: flags["page-size"],
      page_number: flags["page-number"],
    });
    this.outputResult(result.tags, () => result.text);
  }
}
