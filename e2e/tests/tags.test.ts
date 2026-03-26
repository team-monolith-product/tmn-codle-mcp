import { describe, expect, test } from "../fixtures/claude.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

describe("tag search", () => {
  test("도메인별 태그 조회", async ({ claude }) => {
    const result = await claude.run(" 'material' 도메인의 태그를 검색해줘.");

    expectCodleCommand(result, "tag search");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "tag search",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown[]>(interaction!.result!);
    expect(Array.isArray(output)).toBe(true);
  });

  test("키워드 검색", async ({ claude }) => {
    const result = await claude.run(" '파이썬' 관련 태그를 검색해줘.");

    expectCodleCommand(result, "tag search");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "tag search",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown[]>(interaction!.result!);
    expect(Array.isArray(output)).toBe(true);
  });
});
