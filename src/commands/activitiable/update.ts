import { Flags } from "@oclif/core";

import { CodleClient } from "../../api/client.js";
import { CodleAPIError } from "../../api/errors.js";
import {
  buildJsonApiPayload,
  extractList,
  extractSingle,
  pascalToSnake,
} from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";
import {
  convertFromMarkdown,
  resolveLocalImages,
} from "../../lexical/index.js";

interface ActivitiableInfo {
  type: string;
  id: string;
}

async function resolveActivitiable(
  client: CodleClient,
  activityId: string,
): Promise<ActivitiableInfo> {
  const resp = await client.request("GET", `/api/v1/activities/${activityId}`, {
    params: { include: "activitiable" },
  });
  const actData = (resp.data as Record<string, unknown>) || {};
  const relationships =
    (actData.relationships as Record<string, unknown>) || {};
  const activitiable =
    (relationships.activitiable as Record<string, unknown>) || {};
  const rel = (activitiable.data as Record<string, unknown>) || {};
  const id = String(rel.id || "");
  const rawType = String(rel.type || "");
  if (!id || !rawType) {
    throw new Error(`활동 ${activityId}에서 activitiable을 찾을 수 없습니다.`);
  }
  // snake_case → PascalCase
  const type = rawType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return { type, id };
}

export default class ActivitiableUpdate extends BaseCommand {
  static description = "활동의 유형별 속성을 업데이트합니다. 유형은 자동 감지.";

  static examples = [
    "<%= config.bin %> <%= command.id %> --activity-id 456 --content '# 안내문'  # Board",
    "<%= config.bin %> <%= command.id %> --activity-id 456 --content '설명을 작성하세요'  # Sheet",
    "<%= config.bin %> <%= command.id %> --activity-id 456 --url https://example.com  # Embedded/Video",
    "<%= config.bin %> <%= command.id %> --activity-id 456 --goals '목표1' --goals '목표2'  # Embedded/Codap/Makecode/Scratch",
    "<%= config.bin %> <%= command.id %> --activity-id 456 --screen-narration-script '# 나레이션'  # Video",
  ];

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "활동 ID",
    }),
    content: Flags.string({
      description:
        "Board 안내문 또는 Sheet 지시문 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. 크기 지정: `![alt](src =WIDTHxHEIGHT)`",
    }),
    name: Flags.string({ description: "Board 이름" }),
    url: Flags.string({ description: "외부 URL (Embedded/Video)" }),
    goals: Flags.string({
      description:
        "학습목표 (markdown). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식. 크기 지정: `![alt](src =WIDTHxHEIGHT)`",
      multiple: true,
    }),
    "screen-narration-script": Flags.string({
      description:
        "화면 해설 스크립트 (markdown, VideoActivity). 로컬 이미지는 `![alt](file:///abs/path.png)` 형식",
    }),
    "is-exam": Flags.boolean({
      description: "평가용 퀴즈 여부 (QuizActivity)",
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivitiableUpdate);
    let info: ActivitiableInfo;
    try {
      info = await resolveActivitiable(this.client, flags["activity-id"]);
    } catch (e) {
      if (e instanceof CodleAPIError) {
        this.error(`Activity 조회 실패: ${e.detail}`, { exit: 1 });
      }
      if (e instanceof Error) {
        this.error(e.message, { exit: 1 });
      }
      throw e;
    }

    if (info.type === "BoardActivity") {
      if (flags.content === undefined && flags.name === undefined) {
        this.error(
          "BoardActivity: content 또는 name 중 하나 이상 필요합니다.",
          { exit: 1 },
        );
      }
      const boardsResp = await this.client.listBoards({
        "filter[boardable_type]": "Activity",
        "filter[boardable_id]": flags["activity-id"],
      });
      const boards = extractList(boardsResp);
      if (!boards.length) {
        this.error(`활동 ${flags["activity-id"]}에 연결된 Board가 없습니다.`, {
          exit: 1,
        });
      }
      const boardId = String(boards[0].id);
      const attrs: Record<string, unknown> = {};
      if (flags.content !== undefined) {
        const content = await resolveLocalImages(flags.content, this.client);
        attrs.lexical = convertFromMarkdown(content);
      }
      if (flags.name !== undefined) attrs.name = flags.name;
      const payload = buildJsonApiPayload("boards", attrs, boardId);
      const response = await this.client.updateBoard(
        boardId,
        payload as Record<string, unknown>,
      );
      const board = extractSingle(response);
      this.output(board);
      return;
    }

    if (info.type === "SheetActivity") {
      if (flags.content === undefined) {
        this.error("SheetActivity: content는 필수입니다.", { exit: 1 });
      }
      const content = await resolveLocalImages(flags.content!, this.client);
      const lexical = convertFromMarkdown(content);
      const payload = buildJsonApiPayload(
        "sheet_activities",
        { description: lexical },
        info.id,
      );
      const response = await this.client.updateSheetActivity(
        info.id,
        payload as Record<string, unknown>,
      );
      const sheet = extractSingle(response);
      this.output(sheet);
      return;
    }

    if (info.type === "EmbeddedActivity") {
      if (flags.url === undefined && flags.goals === undefined) {
        this.error(
          "EmbeddedActivity: url 또는 goals 중 하나 이상 필요합니다.",
          { exit: 1 },
        );
      }
      const attrs: Record<string, unknown> = {};
      if (flags.url !== undefined) attrs.url = flags.url;
      if (flags.goals !== undefined) {
        const resolvedGoals = await Promise.all(
          flags.goals.map((g) => resolveLocalImages(g, this.client)),
        );
        attrs.goals = resolvedGoals.map((g) => convertFromMarkdown(g));
      }
      const payload = buildJsonApiPayload(
        "embedded_activities",
        attrs,
        info.id,
      );
      const response = await this.client.updateEmbeddedActivity(
        info.id,
        payload as Record<string, unknown>,
      );
      const embedded = extractSingle(response);
      this.output(embedded);
      return;
    }

    if (info.type === "VideoActivity") {
      if (
        flags.url === undefined &&
        flags["screen-narration-script"] === undefined
      ) {
        this.error(
          "VideoActivity: url 또는 screen-narration-script 중 하나 이상 필요합니다.",
          { exit: 1 },
        );
      }
      const attrs: Record<string, unknown> = {};
      if (flags.url !== undefined) attrs.url = flags.url;
      if (flags["screen-narration-script"] !== undefined) {
        const script = await resolveLocalImages(
          flags["screen-narration-script"],
          this.client,
        );
        attrs.screen_narration_script = convertFromMarkdown(script);
      }
      const payload = buildJsonApiPayload("video_activities", attrs, info.id);
      const response = await this.client.request(
        "PUT",
        `/api/v1/video_activities/${info.id}`,
        { json: payload },
      );
      const video = extractSingle(response);
      this.output(video);
      return;
    }

    if (
      info.type === "CodapActivity" ||
      info.type === "MakecodeActivity" ||
      info.type === "ScratchActivity"
    ) {
      if (flags.goals === undefined) {
        this.error(`${info.type}: goals는 필수입니다.`, { exit: 1 });
      }
      const resolvedGoals = await Promise.all(
        flags.goals!.map((g) => resolveLocalImages(g, this.client)),
      );
      const attrs: Record<string, unknown> = {
        goals: resolvedGoals.map((g) => convertFromMarkdown(g)),
      };
      const snakeType = pascalToSnake(info.type);
      const pluralType = snakeType.replace(/y$/, "ies");
      const payload = buildJsonApiPayload(pluralType, attrs, info.id);
      const response = await this.client.request(
        "PUT",
        `/api/v1/${pluralType}/${info.id}`,
        { json: payload },
      );
      const result = extractSingle(response);
      this.output(result);
      return;
    }

    if (info.type === "QuizActivity") {
      if (flags["is-exam"] === undefined) {
        this.error("QuizActivity: is-exam은 필수입니다.", { exit: 1 });
      }
      const payload = buildJsonApiPayload(
        "quiz_activities",
        { is_exam: flags["is-exam"] },
        info.id,
      );
      const response = await this.client.request(
        "PUT",
        `/api/v1/quiz_activities/${info.id}`,
        { json: payload },
      );
      const quiz = extractSingle(response);
      this.output(quiz);
      return;
    }

    this.error(
      `${info.type}은 activitiable update에서 지원하지 않는 유형입니다.`,
      { exit: 1 },
    );
  }
}
