import { Command, Flags } from "@oclif/core";
import { config } from "../../config.js";
import { login } from "../../auth/oauth-flow.js";

export default class AuthLogin extends Command {
  static override description = "로그인";

  static override examples = ["<%= config.bin %> auth login"];

  static override flags = {
    "auth-server-url": Flags.string({
      env: "CODLE_AUTH_SERVER_URL",
      default: config.authServerUrl,
      description: "OAuth 인증 서버 URL",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);
    const authServerUrl = flags["auth-server-url"];

    const credentials = await login(authServerUrl);

    // 로그인 확인: access_token으로 /api/v1/me 조회
    try {
      const meResponse = await fetch(`${config.apiUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${credentials.access_token}` },
      });
      if (meResponse.ok) {
        const me = (await meResponse.json()) as Record<string, unknown>;
        const data = me.data as Record<string, unknown> | undefined;
        const attrs = data?.attributes as Record<string, unknown> | undefined;
        const email = attrs?.email ?? "알 수 없음";
        this.log(`로그인 완료: ${email}`);
      } else {
        this.log("로그인 완료");
      }
    } catch {
      this.log("로그인 완료");
    }
  }
}
