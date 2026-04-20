import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, test } from "../../fixtures/claude.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

// AIDEV-NOTE: CLI의 resolveLocalImages는 file:// URL만 허용한다.
// 테스트 파일 위치 기준으로 fixture의 file:// URL을 미리 계산해 프롬프트에 전달한다.
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_IMAGE_URL = pathToFileURL(
  resolve(__dirname, "../../fixtures/upload-diagram.png"),
).href;

const RAILS_REDIRECT_URL_RE =
  /https?:\/\/[^\s"'()]+\/rails\/active_storage\/blobs\/redirect\/[^\s"'()]+/;

describe("problem create with local image", () => {
  // AIDEV-NOTE: 약한 모델에서 "활동지(sheet)"는 sheet activity와 problem type sheet 사이의 모호성을
  // 일으켜 명령 호출에 실패하는 경우가 있다. 1:1로 매핑되는 "서술형" 용어를 사용한다.
  test("본문의 로컬 이미지 파일이 업로드 URL로 치환", async ({ claude }) => {
    const title = `E2E Image ${Date.now()}`;
    const result = await claude.run(
      `"${title}" 제목으로 서술형 문제를 만들어줘. ` +
        `본문에 "${FIXTURE_IMAGE_URL}" 파일을 이미지로 첨부해서, ` +
        `"이 사진을 보고 떠오르는 점을 자유롭게 적어보세요" 라는 질문으로 만들어줘.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    // CLI 호출 인자에는 아직 로컬 경로가 그대로 들어가 있어야 한다.
    const command = interaction!.call.input.command as string;
    expect(command).toContain("upload-diagram.png");

    // 응답(blocks)에는 업로드된 rails redirect URL이 들어가 있어야 한다.
    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
    const serialized = JSON.stringify(output);
    expect(serialized).toMatch(RAILS_REDIRECT_URL_RE);
    expect(serialized).not.toContain(FIXTURE_IMAGE_URL);
  });
});

describe("problem create with image size", () => {
  test("=WIDTHxHEIGHT 문법으로 문제 본문 이미지에 크기 반영", async ({
    claude,
  }) => {
    const title = `E2E ImgSize Problem ${Date.now()}`;
    const result = await claude.run(
      `"${title}" 제목으로 서술형 문제를 만들어줘. ` +
        `본문에 "${FIXTURE_IMAGE_URL}" 파일을 이미지로 포함하되, ` +
        `이미지 크기를 =600x400 으로 지정해줘. ` +
        `마크다운 이미지 문법 끝에 " =600x400"을 붙이면 돼. ` +
        `예: ![alt](url =600x400). ` +
        `질문은 "이미지를 보고 설명하세요" 로 해줘.`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toMatch(/=600x400/);

    const output = parseCodleOutput<{ id: string }>(interaction!.result!);
    expect(output).toHaveProperty("id");
    const serialized = JSON.stringify(output);
    expect(serialized).toContain('"width":600');
    expect(serialized).toContain('"height":400');
  });
});
