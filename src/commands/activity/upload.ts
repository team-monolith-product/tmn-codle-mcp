import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";

// AIDEV-NOTE: class-rails `ActivityService::Upload` 의 동일 상수와 일치해야 함.
// 규칙이 어긋나 CLI 가 더 엄격한 경우 사용자는 서버 재시도로 우회할 수 있으나,
// 서버가 더 엄격하면 CLI 가 쳐준 결과가 그대로 거절되니 문제되지 않음.
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
        `허용되지 않은 확장자: ${ext || "(없음)"}. 허용 목록: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
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
        `failed to stat file: ${filePath} (${e instanceof Error ? e.message : String(e)})`,
      );
    }
    if (fileStat.size > MAX_BYTE_SIZE) {
      throw new Error(
        `파일 크기가 너무 큽니다: ${fileStat.size} bytes (최대 ${MAX_BYTE_SIZE})`,
      );
    }

    const buffer = await readFile(filePath);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)]),
      basename(filePath),
    );
    formData.append("relative_path", flags.path);

    const resp = await this.client.request(
      "POST",
      `/api/v1/activities/${args.id}/upload`,
      { formData },
    );

    this.output(resp);
  }
}
