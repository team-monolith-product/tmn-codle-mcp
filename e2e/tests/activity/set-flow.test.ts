import { describe, expect, test } from "../../fixtures/claude.js";
import { createActivity, createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("activity set-flow", () => {
  test("seed된 활동으로 코스 흐름 설정", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity1 = await createActivity(factory, material.id, {
      name: "Flow Act 1",
    });
    const activity2 = await createActivity(factory, material.id, {
      name: "Flow Act 2",
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 활동 "${activity1.id}"와 "${activity2.id}"를 순서대로 연결하는 코스 흐름을 설정해줘.`,
    );

    expectCodleCommand(result, "activity set-flow");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-flow",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const output = parseCodleOutput<unknown>(interaction!.result!);
    expect(output).toBeDefined();
  });

  test("--append 플래그로 기존 흐름 유지하며 추가", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);
    const act1 = await createActivity(factory, material.id, {
      name: "Append Act 1",
    });
    const act2 = await createActivity(factory, material.id, {
      name: "Append Act 2",
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 활동 "${act1.id}"와 "${act2.id}"를 코스 흐름에 연결해줘. --append 플래그를 사용해서 기존 흐름은 유지해.`,
    );

    expectCodleCommand(result, "activity set-flow");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity set-flow",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--append");

    const output = parseCodleOutput<{ created: number; destroyed: number }>(
      interaction!.result!,
    );
    expect(output.created).toBe(1);
    expect(output.destroyed).toBe(0);
  });
});
