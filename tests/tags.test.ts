import { describe, expect, test } from "vitest";
import TagSearch from "../src/commands/tag/search.js";
import { runCommand } from "./run-command.js";

describe("TagSearch", () => {
  test("유효하지 않은 domain을 거부한다", async () => {
    const output = await runCommand(TagSearch, [
      "--domain",
      "invalid_domain",
      "--token",
      "dummy",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toMatch(/Expected --domain/);
  });
});
