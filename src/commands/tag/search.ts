import { Flags } from "@oclif/core";

import { extractList } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

const VALID_DOMAINS = [
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
];

export default class TagSearch extends BaseCommand {
  static description = "태그를 검색합니다.";

  static flags = {
    domain: Flags.string({ description: "태그 도메인" }),
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
    const { flags } = await this.parse(TagSearch);

    // AIDEV-NOTE: Tags API는 인증 불필요(before_action 없음)하지만,
    // CLI는 항상 인증된 사용자가 사용하므로 ensureAuth()를 우회하지 않는다.
    const params: Record<string, string | number> = {
      "page[size]": Math.min(flags["page-size"], 100),
      "page[number]": flags["page-number"],
    };
    if (flags.domain && VALID_DOMAINS.includes(flags.domain)) {
      params["filter[domain]"] = flags.domain;
    }
    if (flags.query) {
      params["filter[name_cont]"] = flags.query;
    }

    const response = await this.client.listTags(params);
    const tags = extractList(response);

    if (!tags.length) {
      this.log("태그가 없습니다.");
      return;
    }

    const lines = [`태그 목록 (${tags.length}건):`];
    for (const t of tags) {
      const tagDomain = t.domain ?? "unknown";
      lines.push(
        `  [${t.id}] ${t.name ?? "(무제)"} (domain: ${tagDomain})`,
      );
    }
    this.log(lines.join("\n"));
  }
}
