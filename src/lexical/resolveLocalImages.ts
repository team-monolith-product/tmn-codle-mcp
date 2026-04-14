import { fileURLToPath } from "node:url";

import type { CodleClient } from "../api/client.js";
import { directUploadFile } from "../api/directUpload.js";

// AIDEV-NOTE: markdown 이미지 매칭 regex. transformers.ts IMAGE와 동일한 문법 범위를 커버.
// 그룹2 ([^)\s]+) は src를 캡처한다. src 자체에는 공백이 없으므로 공백이 나오면 그룹3(크기 접미사)의 시작으로 판별된다.
// 그룹3: 선택적 크기 접미사 (e.g. " =400x300", " =400"). URL 치환 시 보존한다.
// \\? — AI 에이전트가 !를 \!로 이스케이프하는 경우를 허용한다.
const IMAGE_REGEX = /\\?!\[([^\]]*)\]\(([^)\s]+)(\s+=\d+(?:x\d+)?)?\)/g;

// AIDEV-NOTE: 호출자(Claude Code 등)는 로컬 파일을 file:// URL로 넘겨야 한다.
// 모든 src를 "URL form"으로 통일하기 위한 설계:
//   - http(s)://  → 원격 URL, 그대로 pass-through
//   - file:///abs → 로컬 파일, 업로드
//   - 그 외(raw path, 상대 경로, 스키마 없음)  → 즉시 reject
// 이유: raw path를 받으면 process.cwd() 의존이 숨고, 에이전트가 의도와 다른
// 파일을 올릴 위험이 있다. file:// URL로 강제하면 호출자가 항상 절대 경로를 명시하게 된다.
const HTTP_SCHEME_REGEX = /^https?:/i;
const FILE_SCHEME_REGEX = /^file:/i;

export async function resolveLocalImages(
  markdown: string,
  client: CodleClient,
): Promise<string> {
  const matches = Array.from(markdown.matchAll(IMAGE_REGEX));
  if (matches.length === 0) return markdown;

  // 먼저 모든 src를 분류해서 유효하지 않은 입력이 하나라도 있으면 업로드 전에 실패한다.
  const uploadTargets: { src: string; absPath: string }[] = [];
  for (const m of matches) {
    const src = m[2];
    if (HTTP_SCHEME_REGEX.test(src)) continue; // 원격 URL: skip
    if (FILE_SCHEME_REGEX.test(src)) {
      let absPath: string;
      try {
        absPath = fileURLToPath(src);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`유효하지 않은 file:// URL (src="${src}"): ${msg}`);
      }
      uploadTargets.push({ src, absPath });
      continue;
    }
    throw new Error(
      `이미지 src는 file:// URL 또는 http(s):// URL이어야 합니다 (src="${src}"). ` +
        `로컬 파일은 file://<절대 경로> 형식으로 전달하세요.`,
    );
  }

  if (uploadTargets.length === 0) return markdown;

  const uploads = await Promise.all(
    uploadTargets.map(async ({ src, absPath }) => {
      try {
        const blob = await directUploadFile(client, absPath);
        return { originalSrc: src, newUrl: blob.url };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`이미지 업로드 실패 (src="${src}"): ${msg}`);
      }
    }),
  );

  const srcToUrl = new Map<string, string>();
  for (const u of uploads) srcToUrl.set(u.originalSrc, u.newUrl);

  return markdown.replace(
    IMAGE_REGEX,
    (full, alt: string, src: string, sizeSuffix?: string) => {
      const newUrl = srcToUrl.get(src);
      if (!newUrl) return full;
      return `![${alt}](${newUrl}${sizeSuffix ?? ""})`;
    },
  );
}
