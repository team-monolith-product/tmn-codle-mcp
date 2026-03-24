import { Command } from "@oclif/core";
import { isExpired, load } from "../../auth/token-manager.js";

export default class AuthStatus extends Command {
  static override description = "현재 인증 상태 확인";

  static override examples = ["<%= config.bin %> auth status"];

  async run(): Promise<void> {
    const credentials = load();

    if (!credentials) {
      this.log("로그인되지 않음. `codle auth login`을 실행하세요.");
      return;
    }

    const expired = isExpired(credentials);
    const expiresAt = new Date(
      (credentials.created_at + credentials.expires_in) * 1000,
    );

    this.log(`인증 서버: ${credentials.auth_server_url}`);
    this.log(`스코프: ${credentials.scope}`);
    this.log(
      `만료: ${expiresAt.toLocaleString()} ${expired ? "(만료됨)" : "(유효)"}`,
    );
  }
}
