import { Args, Flags } from "@oclif/core";

import { extractList } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

export default class TagSearch extends BaseCommand {
  static description = "태그를 검색합니다.";

  static examples = [
    "<%= config.bin %> <%= command.id %> 파이썬",
    "<%= config.bin %> <%= command.id %> --domain material",
    "<%= config.bin %> <%= command.id %> --query 파이썬",
    "<%= config.bin %> <%= command.id %> --domain difficulty --page-size 100",
  ];

  static args = {
    query: Args.string({ description: "검색 키워드" }),
  };

  static flags = {
    domain: Flags.string({
      description: "태그 도메인",
      options: [
        "problem",
        "material",
        "standard_concept",
        "difficulty",
        "school_level",
        "metadata",
        "major_chapter",
        "category",
        "material_bundle_topic",
        "material_bundle_category",
        "material_bundle_language",
      ],
    }),
    query: Flags.string({ description: "태그 이름 검색어" }),
    "page-size": Flags.integer({
      description: "페이지 크기",
      default: 50,
    }),
    "page-number": Flags.integer({
      description: "페이지 번호",
      default: 1,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TagSearch);
    const query = args.query ?? flags.query;

    // AIDEV-NOTE: Tags API는 인증 불필요(before_action 없음)하지만,
    // CLI는 항상 인증된 사용자가 사용하므로 인증 헤더를 항상 전송한다.
    const params: Record<string, string | number> = {
      "page[size]": Math.min(flags["page-size"], 100),
      "page[number]": flags["page-number"],
    };
    if (flags.domain) {
      params["filter[domain]"] = flags.domain;
    }
    if (query) {
      params["filter[name_cont]"] = query;
    }

    const response = await this.client.listTags(params);
    const tags = extractList(response);

    this.output(tags);
  }
}
