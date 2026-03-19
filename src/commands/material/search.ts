import { Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { extractList, formatMaterialSummary } from "../../api/models.js";

export default class MaterialSearch extends BaseCommand {
  static description = "자료(Material)를 검색합니다.";

  static flags = {
    query: Flags.string({ description: "검색 키워드 (자료 이름에서 검색)" }),
    "tag-ids": Flags.string({
      description: "필터링할 태그 ID 목록 (쉼표 구분)",
      multiple: true,
    }),
    "is-public": Flags.boolean({
      description: "공개 여부 필터 (설정 시 공개 자료, 미설정 시 내 자료만)",
      allowNo: false,
    }),
    "page-size": Flags.integer({
      description: "페이지당 결과 수",
      default: 20,
    }),
    "page-number": Flags.integer({
      description: "페이지 번호 (1부터 시작)",
      default: 1,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MaterialSearch);

    const params: Record<string, string | number> = {
      "page[size]": Math.min(flags["page-size"], 100),
      "page[number]": flags["page-number"],
    };

    if (flags.query) params["filter[query]"] = flags.query;

    if (flags["is-public"]) {
      params["filter[is_public]"] = "true";
    } else {
      const me = await this.client.getMe();
      const data = (me.data as Record<string, unknown>) ?? me;
      const userId = String(data.id);
      params["filter[user_id]"] = userId;
    }

    if (flags["tag-ids"]?.length) {
      params["filter[tag_ids]"] = flags["tag-ids"].join(",");
    }

    const response = await this.client.listMaterials(params);
    const materials = extractList(response);

    if (!materials.length) {
      this.log("검색 결과가 없습니다.");
      return;
    }

    const lines = [`자료 검색 결과 (${materials.length}건):`];
    for (const m of materials) {
      lines.push(formatMaterialSummary(m));
    }
    this.log(lines.join("\n"));
  }
}
