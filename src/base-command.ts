import { Command, Flags } from "@oclif/core";
import { CodleClient } from "./api/client.js";
import { CodleAPIError } from "./api/errors.js";
import { load, refresh, type StoredCredentials } from "./auth/token-manager.js";
import { fetchMetadata } from "./auth/metadata.js";
import { config } from "./config.js";

export abstract class BaseCommand extends Command {
  static baseFlags = {
    "api-url": Flags.string({
      env: "CODLE_API_URL",
      default: config.apiUrl,
      description: "API 기본 URL",
    }),
  };

  protected client!: CodleClient;
  private storedCredentials?: StoredCredentials;

  public async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse();

    const credentials = load();
    if (!credentials) {
      this.error("인증 정보가 없습니다. `codle auth login`을 실행하세요.", {
        exit: 1,
      });
      return; // unreachable, but satisfies TS null check
    }

    this.storedCredentials = credentials;

    this.client = new CodleClient(
      credentials.access_token,
      flags["api-url"] as string,
      () => this.refreshToken(),
    );
  }

  private async refreshToken(): Promise<string> {
    if (!this.storedCredentials) {
      throw new Error("세션 만료. `codle auth login`으로 다시 로그인하세요.");
    }

    const metadata = await fetchMetadata(
      this.storedCredentials.auth_server_url,
    );
    const updated = await refresh(
      metadata.token_endpoint,
      this.storedCredentials.client_id,
      this.storedCredentials.refresh_token,
    );

    if (!updated) {
      throw new Error("세션 만료. `codle auth login`으로 다시 로그인하세요.");
    }

    this.storedCredentials = updated;
    return updated.access_token;
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
  // AI가 에러 내용을 읽고 대응할 수 있게 한다.
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
