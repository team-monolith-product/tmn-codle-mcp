import { CodleClient } from "../api/client.js";
import { extractList } from "../api/models.js";

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

export interface SearchTagsParams {
  domain?: string;
  query?: string;
  page_size: number;
  page_number: number;
}

// AIDEV-NOTE: Tags API는 인증 불필요(before_action 없음)하지만,
// CLI는 항상 인증된 사용자가 사용하므로 토큰 검증을 우회하지 않는다.
export async function searchTags(
  client: CodleClient,
  params: SearchTagsParams,
): Promise<{ tags: Record<string, unknown>[]; text: string }> {
  const apiParams: Record<string, string | number> = {
    "page[size]": Math.min(params.page_size, 100),
    "page[number]": params.page_number,
  };
  if (params.domain && VALID_DOMAINS.includes(params.domain)) {
    apiParams["filter[domain]"] = params.domain;
  }
  if (params.query) {
    apiParams["filter[name_cont]"] = params.query;
  }

  const response = await client.listTags(apiParams);
  const tags = extractList(response);

  if (!tags.length) {
    return { tags, text: "태그가 없습니다." };
  }

  const lines = [`태그 목록 (${tags.length}건):`];
  for (const t of tags) {
    const tagDomain = t.domain ?? "unknown";
    lines.push(`  [${t.id}] ${t.name ?? "(무제)"} (domain: ${tagDomain})`);
  }
  return { tags, text: lines.join("\n") };
}
