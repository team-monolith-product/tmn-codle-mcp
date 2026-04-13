import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CodleClient } from "../src/api/client.js";
import { resolveLocalImages } from "../src/lexical/resolveLocalImages.js";

function makeMockClient(): CodleClient {
  return {
    getBaseUrl: vi.fn(() => "https://class.codle.io"),
    createDirectUpload: vi.fn(async (blob: { filename: string }) => ({
      signed_id: `sid-${blob.filename}`,
      filename: blob.filename,
      direct_upload: {
        url: `https://s3/upload/${blob.filename}`,
        headers: {},
      },
    })),
  } as unknown as CodleClient;
}

function makeFile(dir: string, name: string, content = "x"): string {
  const full = join(dir, name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, Buffer.from(content));
  return full;
}

function fileUrl(absPath: string): string {
  return pathToFileURL(absPath).href;
}

describe("resolveLocalImages", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "resolve-local-images-"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
      }),
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("leaves markdown unchanged when there are no images", async () => {
    const md = "# Hello\n\nplain text";
    const client = makeMockClient();
    const result = await resolveLocalImages(md, client);
    expect(result).toBe(md);
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("leaves http/https URLs untouched", async () => {
    const md = [
      "![a](https://example.com/a.png)",
      "![b](http://example.com/b.png)",
    ].join("\n");
    const client = makeMockClient();
    const result = await resolveLocalImages(md, client);
    expect(result).toBe(md);
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("uploads a file:// URL", async () => {
    const absPath = makeFile(tmpDir, "diagram.png");
    const client = makeMockClient();
    const md = `![다이어그램](${fileUrl(absPath)})`;
    const result = await resolveLocalImages(md, client);
    expect(result).toBe(
      "![다이어그램](https://class.codle.io/rails/active_storage/blobs/redirect/sid-diagram.png/diagram.png)",
    );
    expect(client.createDirectUpload).toHaveBeenCalledTimes(1);
  });

  it("rejects raw absolute paths (not file:// URLs)", async () => {
    const absPath = makeFile(tmpDir, "diagram.png");
    const client = makeMockClient();
    const md = `![x](${absPath})`;
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects relative './' paths", async () => {
    const client = makeMockClient();
    const md = "![x](./img.png)";
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http.*src="\.\/img\.png"/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects bare-filename paths", async () => {
    const client = makeMockClient();
    const md = "![x](img.png)";
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http.*src="img\.png"/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects parent-dir relative paths", async () => {
    const client = makeMockClient();
    const md = "![x](../img.png)";
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http.*src="\.\.\/img\.png"/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects data: URIs (not supported in this PR)", async () => {
    const client = makeMockClient();
    const md = "![x](data:image/png;base64,AAA)";
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("rejects mailto: and other non-file schemes", async () => {
    const client = makeMockClient();
    const md = "![x](mailto:foo@bar)";
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("preserves alt text after substitution", async () => {
    const absPath = makeFile(tmpDir, "img.png");
    const client = makeMockClient();
    const result = await resolveLocalImages(
      `![매우 길고 한글이 섞인 alt](${fileUrl(absPath)})`,
      client,
    );
    expect(result).toMatch(/^!\[매우 길고 한글이 섞인 alt\]\(/);
  });

  it("uploads multiple file:// URLs in parallel and leaves remote URLs untouched", async () => {
    const aPath = makeFile(tmpDir, "a.png");
    const bPath = makeFile(tmpDir, "b.png");
    const client = makeMockClient();
    const md = `![local a](${fileUrl(aPath)}) ![remote](https://example.com/r.png) ![local b](${fileUrl(bPath)})`;
    const result = await resolveLocalImages(md, client);

    expect(result).toContain("redirect/sid-a.png/a.png");
    expect(result).toContain("redirect/sid-b.png/b.png");
    expect(result).toContain("https://example.com/r.png");
    expect(client.createDirectUpload).toHaveBeenCalledTimes(2);
  });

  it("throws with src in the message when file is missing", async () => {
    const client = makeMockClient();
    const missing = join(tmpDir, "nonexistent.png");
    const md = `![x](${fileUrl(missing)})`;
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /이미지 업로드 실패.*file:/,
    );
  });

  it("ignores regular markdown links (no bang prefix)", async () => {
    const client = makeMockClient();
    const absPath = makeFile(tmpDir, "img.png");
    const md = `[doc link](./doc.md) and ![](${fileUrl(absPath)})`;
    const result = await resolveLocalImages(md, client);
    expect(result).toContain("[doc link](./doc.md)");
    expect(result).toContain("redirect/sid-img.png/img.png");
    expect(client.createDirectUpload).toHaveBeenCalledTimes(1);
  });

  it("fails fast on mixed valid file:// + invalid raw path without uploading anything", async () => {
    const absPath = makeFile(tmpDir, "a.png");
    const client = makeMockClient();
    const md = `![a](${fileUrl(absPath)}) ![b](/some/raw/path.png)`;
    await expect(resolveLocalImages(md, client)).rejects.toThrow(
      /file:\/\/ URL 또는 http.*src="\/some\/raw\/path\.png"/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });
});
