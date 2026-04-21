import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { Args, Flags } from "@oclif/core";

import type { CodleClient } from "../../api/client.js";
import { BaseCommand } from "../../base-command.js";

// AIDEV-NOTE: class-rails `StudioActivityService::Upload` 의 동일 상수와 일치해야 함.
const MAX_BYTE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = new Set([
  ".py",
  ".ipynb",
  ".md",
  ".txt",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".pdf",
]);

// AIDEV-NOTE: html-activity-page/sync.ts 의 resolveHtmlActivityId 와 동일 패턴.
async function resolveStudioActivityId(
  client: CodleClient,
  activityId: string,
): Promise<string> {
  const resp = await client.request("GET", `/api/v1/activities/${activityId}`, {
    params: { include: "activitiable" },
  });
  const actData = (resp.data as Record<string, unknown>) || {};
  const relationships =
    (actData.relationships as Record<string, unknown>) || {};
  const activitiable =
    (relationships.activitiable as Record<string, unknown>) || {};
  const rel = (activitiable.data as Record<string, unknown>) || {};
  const id = String(rel.id || "");
  const rawType = String(rel.type || "");
  if (!id || !rawType) {
    throw new Error(`활동 ${activityId}에서 activitiable을 찾을 수 없습니다.`);
  }
  const type = rawType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  if (type !== "StudioActivity") {
    throw new Error(
      `활동 ${activityId}의 유형이 ${type}입니다. StudioActivity만 지원합니다.`,
    );
  }
  return id;
}

export default class ActivityUpload extends BaseCommand {
  static description =
    "활동(Activity) 수정환경에 로컬 파일을 업로드합니다. StudioActivity만 지원.";

  static examples = [
    "<%= config.bin %> <%= command.id %> 456 --file-path ./main.py",
    "<%= config.bin %> <%= command.id %> 456 --file-path ./data.csv --path data",
  ];

  static args = {
    id: Args.string({ description: "활동 ID", required: true }),
  };

  static flags = {
    "file-path": Flags.string({
      required: true,
      description:
        "업로드할 로컬 파일 (≤10MB, py/ipynb/md/txt/csv/tsv/json/yaml/xml/png/jpg/gif/webp/svg/bmp/pdf)",
    }),
    path: Flags.string({
      default: ".",
      description: "mount 루트 기준 상대 디렉터리 (기본 '.')",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ActivityUpload);
    const filePath = flags["file-path"];

    const ext = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `허용되지 않은 확장자: ${ext || "(없음)"}. 허용 목록: ${[
          ...ALLOWED_EXTENSIONS,
        ].join(", ")}`,
      );
    }

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(filePath);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new Error(`file not found: ${filePath}`);
      }
      throw new Error(
        `failed to stat file: ${filePath} (${
          e instanceof Error ? e.message : String(e)
        })`,
      );
    }
    if (fileStat.size > MAX_BYTE_SIZE) {
      throw new Error(
        `파일 크기가 너무 큽니다: ${fileStat.size} bytes (최대 ${MAX_BYTE_SIZE})`,
      );
    }

    const studioActivityId = await resolveStudioActivityId(
      this.client,
      args.id,
    );

    const buffer = await readFile(filePath);
    const fullName = basename(filePath);
    const extension = ext.startsWith(".") ? ext.slice(1) : ext;
    const stem = extension
      ? fullName.slice(0, -(extension.length + 1))
      : fullName;

    // path = 디렉터리 + 파일명 stem 결합. 서버가 마지막 컴포넌트를 stem 으로 사용.
    const dirPath = flags.path === "." ? "" : flags.path;
    const fullPath = dirPath ? `${dirPath}/${stem}` : stem;

    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(buffer)]), fullName);
    formData.append("path", fullPath);
    formData.append("extension", extension);

    const resp = await this.client.request(
      "POST",
      `/api/v1/studio_activities/${studioActivityId}/upload`,
      { formData },
    );

    this.output(resp);
  }
}
