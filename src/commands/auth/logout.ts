import { Command } from "@oclif/core";
import { clear } from "../../auth/token-manager.js";

export default class AuthLogout extends Command {
  static override description = "저장된 인증 정보 삭제";

  static override examples = ["<%= config.bin %> auth logout"];

  async run(): Promise<void> {
    clear();
    this.log("로그아웃 완료");
  }
}
