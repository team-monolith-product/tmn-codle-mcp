import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
  request: vi.fn(),
};
vi.mock("../src/api/client.js", () => ({
  CodleClient: vi.fn(() => mockClient),
}));
vi.mock("../src/auth/token-manager.js", () => ({
  load: () => ({
    access_token: "test-token",
    auth_server_url: "",
    client_id: "",
    refresh_token: "",
    scope: "public",
    created_at: 0,
    expires_in: 99999,
  }),
}));

import ActivityUpload from "../src/commands/activity/upload.js";
import { runCommand } from "./run-command.js";

describe("activity upload", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(join(tmpdir(), "activity-upload-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("sends multipart POST with file and relative_path='.'", async () => {
    const filePath = join(tmpDir, "main.py");
    writeFileSync(filePath, "print('hello')\n");

    mockClient.request.mockResolvedValue({
      filename: "main.py",
      relative_path: "main.py",
      byte_size: 15,
      content_type: "text/x-python",
    });

    await runCommand(ActivityUpload, ["456", "--file-path", filePath]);

    expect(mockClient.request).toHaveBeenCalledTimes(1);
    const [method, url, opts] = mockClient.request.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/v1/activities/456/upload");

    const formData = opts.formData as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("relative_path")).toBe(".");

    const filePart = formData.get("file");
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as File).name).toBe("main.py");
  });

  it("forwards --path as relative_path", async () => {
    const filePath = join(tmpDir, "data.csv");
    writeFileSync(filePath, "a,b\n1,2\n");

    mockClient.request.mockResolvedValue({});

    await runCommand(ActivityUpload, [
      "456",
      "--file-path",
      filePath,
      "--path",
      "data/problem1",
    ]);

    const [, , opts] = mockClient.request.mock.calls[0];
    const formData = opts.formData as FormData;
    expect(formData.get("relative_path")).toBe("data/problem1");
  });

  it("rejects disallowed extensions before hitting the server", async () => {
    const filePath = join(tmpDir, "script.sh");
    writeFileSync(filePath, "#!/bin/sh\n");

    await runCommand(ActivityUpload, ["456", "--file-path", filePath]);

    expect(mockClient.request).not.toHaveBeenCalled();
  });

  it("rejects files larger than MAX_BYTE_SIZE before hitting the server", async () => {
    const filePath = join(tmpDir, "big.py");
    // 10MB + 1 byte
    writeFileSync(filePath, Buffer.alloc(10 * 1024 * 1024 + 1));

    await runCommand(ActivityUpload, ["456", "--file-path", filePath]);

    expect(mockClient.request).not.toHaveBeenCalled();
  });

  it("errors when local file does not exist", async () => {
    const missing = join(tmpDir, "no.py");

    // BaseCommand 가 에러를 catch 해서 JSON 으로 출력하고 exit 0 으로 종료한다.
    await runCommand(ActivityUpload, ["456", "--file-path", missing]);
    expect(mockClient.request).not.toHaveBeenCalled();
  });
});
