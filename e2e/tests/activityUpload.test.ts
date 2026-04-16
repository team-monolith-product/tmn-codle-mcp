import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE_PATH = resolve(__dirname, "../fixtures/upload-solution.py");

describe("activity upload", () => {
  test("StudioActivity 마운트에 로컬 파이썬 파일 업로드", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);
    // AIDEV-NOTE: createActivity 기본값이 StudioActivity(url set)이므로 그대로 사용 가능.
    const activity = await createActivity(factory, material.id);

    const result = await claude.run(
      `활동 ID "${activity.id}"의 수정환경에 "${FIXTURE_FILE_PATH}" 파일을 업로드해줘. ` +
        "업로드 경로는 루트(기본값)로 해.",
    );

    expectCodleCommand(result, "activity upload");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity upload",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    // CLI 인자에 활동 ID와 file-path 가 들어 있어야 한다.
    const command = interaction!.call.input.command as string;
    expect(command).toContain(activity.id);
    expect(command).toContain("upload-solution.py");

    // 응답에 filename, relative_path, byte_size 가 있어야 한다.
    const output = parseCodleOutput<{
      filename: string;
      relative_path: string;
      byte_size: number;
    }>(interaction!.result!);
    expect(output.filename).toBe("upload-solution.py");
    expect(output.relative_path).toBe("upload-solution.py");
    expect(output.byte_size).toBeGreaterThan(0);
  });

  test("--path 지정 시 하위 디렉터리에 업로드", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id);

    const result = await claude.run(
      `활동 ID "${activity.id}"의 수정환경 "data" 하위 폴더에 ` +
        `"${FIXTURE_FILE_PATH}" 파일을 업로드해줘.`,
    );

    expectCodleCommand(result, "activity upload");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "activity upload",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("--path");
    expect(command).toContain("data");

    const output = parseCodleOutput<{ relative_path: string }>(
      interaction!.result!,
    );
    expect(output.relative_path).toBe("data/upload-solution.py");
  });
});
