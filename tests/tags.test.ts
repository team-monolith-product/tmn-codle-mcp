import { describe, expect, test } from "vitest";
import TagSearch from "../src/commands/tag/search.js";

describe("TagSearch", () => {
  test("유효하지 않은 domain을 거부한다", async () => {
    await expect(
      TagSearch.run(["--domain", "invalid_domain", "--token", "dummy"]),
    ).rejects.toThrow(/Expected --domain/);
  });
});
