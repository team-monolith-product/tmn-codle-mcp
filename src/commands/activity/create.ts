import { Flags } from "@oclif/core";

import { CodleAPIError } from "../../api/errors.js";
import {
  buildJsonApiPayload,
  extractSingle,
  pascalToSnake,
} from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

const ACTIVITIABLE_ENDPOINTS: Record<string, string> = {
  QuizActivity: "/api/v1/quiz_activities",
  StudioActivity: "/api/v1/studio_activities",
  EntryActivity: "/api/v1/entry_activities",
  ScratchActivity: "/api/v1/scratch_activities",
  BoardActivity: "/api/v1/board_activities",
  VideoActivity: "/api/v1/video_activities",
  PdfActivity: "/api/v1/pdf_activities",
  SheetActivity: "/api/v1/sheet_activities",
  HtmlActivity: "/api/v1/html_activities",
  GenerativeHtmlActivity: "/api/v1/generative_html_activities",
  MakecodeActivity: "/api/v1/makecode_activities",
  CodapActivity: "/api/v1/codap_activities",
  EmbeddedActivity: "/api/v1/embedded_activities",
  SocroomActivity: "/api/v1/socroom_activities",
  AiRecommendQuizActivity: "/api/v1/ai_recommend_quiz_activities",
};

const ACTIVITIABLE_TYPES = Object.keys(ACTIVITIABLE_ENDPOINTS);

function normalizeActivityType(input: string): string {
  if (ACTIVITIABLE_TYPES.includes(input)) return input;
  const withSuffix = input + "Activity";
  if (ACTIVITIABLE_TYPES.includes(withSuffix)) return withSuffix;
  return input;
}

export default class ActivityCreate extends BaseCommand {
  static description =
    "활동(Activity)을 생성합니다. 유형: 퀴즈=Quiz, 교안=Html, 보드=Board, 활동지=Sheet, 영상=Video, 외부URL=Embedded, 엔트리=Entry 등";

  static examples = [
    "<%= config.bin %> <%= command.id %> --material-id 1 --name '1단원 퀴즈' --type Quiz",
    "<%= config.bin %> <%= command.id %> --material-id 1 --name '교안 활동' --type Html --depth 2",
    "<%= config.bin %> <%= command.id %> --material-id 1 --name '엔트리' --type Entry --entry-category stage",
  ];

  static flags = {
    "material-id": Flags.string({
      required: true,
      description: "자료 ID",
    }),
    name: Flags.string({
      required: true,
      description: "활동 이름 (최대 64자)",
    }),
    type: Flags.string({
      required: true,
      description: "활동 유형. Html, Quiz, Board, Sheet, Video, Embedded 등",
    }),
    depth: Flags.integer({
      description: "활동 깊이, 1-indexed (1=메인, 2=하위). 미지정 시 1",
    }),
    "tag-ids": Flags.string({
      description: "연결할 태그 ID",
      multiple: true,
    }),
    "entry-category": Flags.string({
      description: "엔트리 활동 카테고리 (EntryActivity일 때 필수)",
      options: ["project", "stage"],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityCreate);
    const resolvedType = normalizeActivityType(flags.type);

    if (!ACTIVITIABLE_TYPES.includes(resolvedType)) {
      this.error(
        `유효하지 않은 activity_type: ${
          flags.type
        }. 사용 가능: ${ACTIVITIABLE_TYPES.join(", ")}`,
        { exit: 1 },
      );
    }

    if (resolvedType === "EntryActivity" && !flags["entry-category"]) {
      this.error(
        "EntryActivity 생성 시 entry-category(project 또는 stage)는 필수입니다.",
        { exit: 1 },
      );
    }

    // Step 1: create activitiable
    const endpoint = ACTIVITIABLE_ENDPOINTS[resolvedType];
    const jsonapiType = pascalToSnake(resolvedType);
    const activitiableAttrs: Record<string, unknown> = {};

    // AIDEV-NOTE: entry_category는 Rails EntryActivity에 validates_immutable :category가 있어
    // 생성 후 변경 불가. 따라서 create 시에만 설정하며, activitiable update로 이관하지 않는다.
    if (resolvedType === "EntryActivity" && flags["entry-category"]) {
      activitiableAttrs.category = flags["entry-category"];
    }

    const activitiablePayload = {
      data: { type: jsonapiType, attributes: activitiableAttrs },
    };

    let activitiableId: string;
    try {
      const activitiableResponse = await this.client.request("POST", endpoint, {
        json: activitiablePayload,
      });
      const activitiableData =
        (activitiableResponse.data as Record<string, unknown>) || {};
      activitiableId = String(activitiableData.id || "");
      if (!activitiableId) {
        this.error(`activitiable(${resolvedType}) 생성 실패: 응답에 id 없음.`, {
          exit: 1,
        });
      }
    } catch (e) {
      if (e instanceof CodleAPIError) {
        this.error(`activitiable(${resolvedType}) 생성 실패: ${e.detail}`, {
          exit: 1,
        });
      }
      throw e;
    }

    // Step 2: create activity
    // depth: 1-indexed (user) -> 0-indexed (Rails API). Default 1 (= main)
    const apiDepth = Math.max(0, (flags.depth ?? 1) - 1);
    const attrs: Record<string, unknown> = {
      name: flags.name,
      material_id: flags["material-id"],
      depth: apiDepth,
      activitiable_type: resolvedType,
      activitiable_id: activitiableId,
    };
    if (flags["tag-ids"]?.length) attrs.tag_ids = flags["tag-ids"];

    const payload = buildJsonApiPayload("activities", attrs);
    const response = await this.client.createActivity(
      payload as Record<string, unknown>,
    );
    const activity = extractSingle(response);
    this.output(activity);
  }
}
