import { Command, Flags } from "@oclif/core";
import { CodleClient } from "./api/client.js";
import { CodleAPIError } from "./api/errors.js";
import { config } from "./config.js";

export abstract class BaseCommand extends Command {
  static baseFlags = {
    token: Flags.string({
      env: "CODLE_TOKEN",
      required: true,
      description: "Codle API 인증 토큰",
    }),
    "api-url": Flags.string({
      env: "CODLE_API_URL",
      default: config.apiUrl,
      description: "Codle API URL",
    }),
    output: Flags.string({
      options: ["text", "json"],
      default: "text",
      description: "출력 형식",
    }),
  };

  protected client!: CodleClient;
  protected parsedFlags!: Record<string, unknown>;

  async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse(
      this.constructor as typeof BaseCommand,
    );
    this.parsedFlags = flags;
    this.client = new CodleClient(
      flags.token,
      flags["api-url"],
    );
  }

  protected outputResult(
    data: unknown,
    textFormatter: (data: unknown) => string,
  ): void {
    if (this.parsedFlags.output === "json") {
      this.log(JSON.stringify(data, null, 2));
    } else {
      this.log(textFormatter(data));
    }
  }

  async catch(err: Error & { exitCode?: number }): Promise<void> {
    if (err instanceof CodleAPIError) {
      this.error(`API 에러 (${err.statusCode}): ${err.detail}`, {
        exit: 1,
      });
    }
    throw err;
  }
}
