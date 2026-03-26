import { Command, Flags } from "@oclif/core";
import { CodleClient } from "./api/client.js";
import { CodleAPIError } from "./api/errors.js";
import { config } from "./config.js";

export abstract class BaseCommand extends Command {
  static baseFlags = {
    token: Flags.string({
      env: "CODLE_TOKEN",
      required: true,
      description: "API 접근 토큰",
    }),
    "api-url": Flags.string({
      env: "CODLE_API_URL",
      default: config.apiUrl,
      description: "API 기본 URL",
    }),
  };

  protected client!: CodleClient;

  public async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse();
    this.client = new CodleClient(
      flags.token as string,
      flags["api-url"] as string,
    );
  }

  protected output(data: unknown): void {
    this.log(JSON.stringify(data));
  }

  protected parseJsonFlag<T>(flagName: string, value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      this.error(
        `--${flagName}의 JSON 형식이 올바르지 않습니다: ${value.slice(0, 100)}`,
        { exit: 1 },
      );
    }
  }

  // AIDEV-NOTE: 에러를 JSON으로 출력하고 exit 0으로 종료한다.
  // MCP는 에러를 isError: false + 텍스트로 반환하여 AI가 컨텍스트를 유지한 채 재시도 가능.
  // CLI도 동일하게 에러를 stdout JSON으로 반환하여 AI가 에러 내용을 읽고 대응할 수 있게 한다.
  async catch(
    err: Error & { exitCode?: number; code?: string },
  ): Promise<void> {
    const message =
      err instanceof CodleAPIError
        ? `API 에러 (${err.statusCode}): ${err.detail}`
        : err.message;
    this.log(JSON.stringify({ error: true, message }));
  }
}
