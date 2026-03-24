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

  async catch(
    err: Error & { exitCode?: number; code?: string },
  ): Promise<void> {
    if (err instanceof CodleAPIError) {
      this.error(`API 에러 (${err.statusCode}): ${err.detail}`, { exit: 1 });
    }
    this.error(err.message, { exit: 1 });
  }
}
