import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { manageHtmlActivityPages } from "../../services/htmlActivityPage.service.js";

export default class HtmlActivityPageManage extends BaseCommand {
  static override description =
    "교안(HtmlActivity)의 페이지 목록을 선언적으로 설정합니다.";

  static override args = {
    "activity-id": Args.string({ description: "교안 활동 ID", required: true }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    "pages-json": Flags.string({
      description:
        'pages JSON 배열. 예: \'[{"url":"https://..."},{"url":"https://...","width":800}]\'',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(HtmlActivityPageManage);
    const pages = JSON.parse(flags["pages-json"]) as Array<{
      url: string;
      width?: number;
      height?: number;
      progress_calculation_method?: "time" | "no_calculation";
      completion_seconds?: number;
    }>;
    const result = await manageHtmlActivityPages(this.client, {
      activity_id: args["activity-id"],
      pages,
    });
    this.log(result.text);
  }
}
