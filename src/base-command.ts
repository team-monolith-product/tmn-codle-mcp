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
    output: Flags.string({
      options: ["text", "json"],
      default: "text",
      description: "출력 형식",
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

  protected outputResult(text: string, json?: unknown): void {
    const { flags } = this as unknown as {
      flags: { output: string };
    };
    if (flags?.output === "json" && json !== undefined) {
      this.log(JSON.stringify(json, null, 2));
    } else {
      this.log(text);
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
