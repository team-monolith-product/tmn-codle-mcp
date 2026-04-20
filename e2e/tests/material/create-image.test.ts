import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, test } from "../../fixtures/claude.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_IMAGE_URL = pathToFileURL(
  resolve(__dirname, "../../fixtures/upload-diagram.png"),
).href;

const RAILS_REDIRECT_URL_RE =
  /https?:\/\/[^\s"'()]+\/rails\/active_storage\/blobs\/redirect\/[^\s"'()]+/;

describe("material create with image size", () => {
  test("=WIDTHxHEIGHT 문법으로 이미지 크기가 Lexical JSON에 반영", async ({
    claude,
  }) => {
    const name = `E2E ImgSize ${Date.now()}`;
    const result = await claude.run(
      `"${name}" 이름으로 새 자료를 만들어줘. ` +
        `본문에 "${FIXTURE_IMAGE_URL}" 파일을 이미지로 포함하되, ` +
        `이미지 크기를 =400x300 으로 지정해줘. ` +
        `마크다운 이미지 문법 끝에 " =400x300"을 붙이면 돼. ` +
        `예: ![alt](url =400x300)`,
    );

    expectCodleCommand(result, "material create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    // CLI 호출 인자에 =400x300 이 포함되어야 한다.
    const command = interaction!.call.input.command as string;
    expect(command).toMatch(/=400x300/);

    // Lexical JSON 응답에 width:400, height:300이 있어야 한다.
    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
    const serialized = JSON.stringify(output);
    expect(serialized).toContain('"width":400');
    expect(serialized).toContain('"height":300');
  });
});

describe("material create with width-only image size", () => {
  // AIDEV-NOTE: =WIDTH (height 생략) 문법 — height는 0으로 처리되어
  // CDS에서 "inherit"(자연 비율)로 해석된다.
  test("=WIDTH 문법으로 width만 지정 시 height는 0", async ({ claude }) => {
    const name = `E2E ImgW ${Date.now()}`;
    const result = await claude.run(
      `"${name}" 이름으로 새 자료를 만들어줘. ` +
        `본문에 "${FIXTURE_IMAGE_URL}" 파일을 이미지로 포함하되, ` +
        `이미지 너비만 =500 으로 지정해줘. 높이는 생략해. ` +
        `마크다운 이미지 문법 끝에 " =500"을 붙이면 돼. ` +
        `예: ![alt](url =500)`,
    );

    expectCodleCommand(result, "material create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toMatch(/=500(?!x)/);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
    const serialized = JSON.stringify(output);
    expect(serialized).toContain('"width":500');
    expect(serialized).toContain('"height":0');
  });
});

describe("material create with local image", () => {
  test("본문(body)의 로컬 이미지가 업로드 URL로 치환", async ({ claude }) => {
    const name = `E2E Image Material ${Date.now()}`;
    const result = await claude.run(
      `"${name}" 이름으로 새 자료를 만들어줘. ` +
        `본문은 "${FIXTURE_IMAGE_URL}" 파일을 이미지로 포함한 간단한 안내문으로 해줘.`,
    );

    expectCodleCommand(result, "material create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("upload-diagram.png");

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
    const serialized = JSON.stringify(output);
    expect(serialized).toMatch(RAILS_REDIRECT_URL_RE);
    expect(serialized).not.toContain(FIXTURE_IMAGE_URL);
  });
});
