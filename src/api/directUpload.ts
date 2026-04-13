import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { logger } from "../logger.js";
import type { CodleClient, DirectUploadResponse } from "./client.js";

export interface UploadedBlob {
  signedId: string;
  filename: string;
  url: string;
}

// AIDEV-NOTE: Rails는 업로드된 blob을 확장자로 판단하지 않으므로 MIME 맵은 이미지 위주 최소 집합이면 충분.
// 매치되지 않는 경우 application/octet-stream으로 폴백한다.
const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function detectContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
}

export async function directUploadFile(
  client: CodleClient,
  filePath: string,
): Promise<UploadedBlob> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new Error(`file not found: ${filePath}`);
    }
    throw new Error(
      `failed to read file: ${filePath} (${e instanceof Error ? e.message : String(e)})`,
    );
  }

  const checksum = createHash("md5").update(buffer).digest("base64");
  const filename = basename(filePath);
  const contentType = detectContentType(filePath);

  logger.debug(
    "direct upload 시작: %s (%d bytes, %s)",
    filePath,
    buffer.byteLength,
    contentType,
  );

  const directUpload: DirectUploadResponse = await client.createDirectUpload({
    filename,
    content_type: contentType,
    byte_size: buffer.byteLength,
    checksum,
  });

  // AIDEV-NOTE: S3 PUT은 Rails가 아닌 presigned URL로 나가므로 client.request()가 아닌
  // 생 fetch를 사용한다. direct_upload.headers를 그대로 넘겨야 서명 검증을 통과한다.
  const putResponse = await fetch(directUpload.direct_upload.url, {
    method: "PUT",
    headers: directUpload.direct_upload.headers,
    body: new Uint8Array(buffer),
  });

  if (!putResponse.ok) {
    const text = await putResponse.text().catch(() => "");
    throw new Error(
      `direct upload S3 PUT 실패 (${putResponse.status}): ${text.slice(0, 500)}`,
    );
  }

  const signedId = directUpload.signed_id;
  const url =
    `${client.getBaseUrl()}/rails/active_storage/blobs/redirect/` +
    `${signedId}/${encodeURIComponent(filename)}`;

  logger.debug("direct upload 완료: %s → %s", filePath, url);

  return { signedId, filename, url };
}
