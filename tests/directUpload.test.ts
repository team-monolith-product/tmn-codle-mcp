import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CodleClient } from "../src/api/client.js";
import { directUploadFile } from "../src/api/directUpload.js";

function makeMockClient(): CodleClient {
  const mock = {
    getBaseUrl: vi.fn(() => "https://class.codle.io"),
    createDirectUpload: vi.fn(),
  };
  return mock as unknown as CodleClient;
}

describe("directUploadFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "direct-upload-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("uploads a file with correct checksum and payload", async () => {
    const filePath = join(tmpDir, "diagram.png");
    const content = Buffer.from("fake png content");
    writeFileSync(filePath, content);
    const expectedChecksum = createHash("md5")
      .update(content)
      .digest("base64");

    const client = makeMockClient();
    (client.createDirectUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
      signed_id: "abc123",
      filename: "diagram.png",
      direct_upload: {
        url: "https://s3.example.com/upload",
        headers: { "Content-MD5": expectedChecksum, "x-custom": "hdr" },
      },
    });

    const putFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.stubGlobal("fetch", putFetch);

    const result = await directUploadFile(client, filePath);

    // createDirectUpload payload
    expect(client.createDirectUpload).toHaveBeenCalledWith({
      filename: "diagram.png",
      content_type: "image/png",
      byte_size: content.byteLength,
      checksum: expectedChecksum,
    });

    // S3 PUT call
    expect(putFetch).toHaveBeenCalledTimes(1);
    const [putUrl, putOpts] = putFetch.mock.calls[0];
    expect(putUrl).toBe("https://s3.example.com/upload");
    expect(putOpts.method).toBe("PUT");
    expect(putOpts.headers).toEqual({
      "Content-MD5": expectedChecksum,
      "x-custom": "hdr",
    });

    // redirect URL
    expect(result).toEqual({
      signedId: "abc123",
      filename: "diagram.png",
      url: "https://class.codle.io/rails/active_storage/blobs/redirect/abc123/diagram.png",
    });
  });

  it("encodes filename with non-ASCII characters in redirect URL", async () => {
    const filePath = join(tmpDir, "그림.png");
    writeFileSync(filePath, Buffer.from("x"));

    const client = makeMockClient();
    (client.createDirectUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
      signed_id: "sid",
      filename: "그림.png",
      direct_upload: { url: "https://s3/u", headers: {} },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }),
    );

    const result = await directUploadFile(client, filePath);
    expect(result.url).toBe(
      `https://class.codle.io/rails/active_storage/blobs/redirect/sid/${encodeURIComponent("그림.png")}`,
    );
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const filePath = join(tmpDir, "note.txt");
    writeFileSync(filePath, Buffer.from("hello"));

    const client = makeMockClient();
    (client.createDirectUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
      signed_id: "sid",
      filename: "note.txt",
      direct_upload: { url: "https://s3/u", headers: {} },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }),
    );

    await directUploadFile(client, filePath);
    const call = (client.createDirectUpload as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.content_type).toBe("application/octet-stream");
  });

  it("detects common image MIME types from extension", async () => {
    const cases: Array<[string, string]> = [
      ["a.jpg", "image/jpeg"],
      ["a.jpeg", "image/jpeg"],
      ["a.gif", "image/gif"],
      ["a.webp", "image/webp"],
      ["a.svg", "image/svg+xml"],
      ["a.PNG", "image/png"],
    ];
    for (const [name, expected] of cases) {
      const filePath = join(tmpDir, name);
      writeFileSync(filePath, Buffer.from("x"));

      const client = makeMockClient();
      (
        client.createDirectUpload as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        signed_id: "sid",
        filename: name,
        direct_upload: { url: "https://s3/u", headers: {} },
      });
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue({ ok: true, status: 200, text: async () => "" }),
      );

      await directUploadFile(client, filePath);
      const call = (
        client.createDirectUpload as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(call.content_type).toBe(expected);
    }
  });

  it("throws a clear error when file does not exist", async () => {
    const client = makeMockClient();
    const missing = join(tmpDir, "nope.png");

    await expect(directUploadFile(client, missing)).rejects.toThrow(
      /file not found/,
    );
    expect(client.createDirectUpload).not.toHaveBeenCalled();
  });

  it("throws when S3 PUT returns non-200", async () => {
    const filePath = join(tmpDir, "x.png");
    writeFileSync(filePath, Buffer.from("x"));

    const client = makeMockClient();
    (client.createDirectUpload as ReturnType<typeof vi.fn>).mockResolvedValue({
      signed_id: "sid",
      filename: "x.png",
      direct_upload: { url: "https://s3/u", headers: {} },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      }),
    );

    await expect(directUploadFile(client, filePath)).rejects.toThrow(
      /S3 PUT 실패.*403/,
    );
  });
});
