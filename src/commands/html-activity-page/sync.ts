import { Flags } from "@oclif/core";

import { CodleClient } from "../../api/client.js";
import { extractIncluded } from "../../api/models.js";
import { BaseCommand } from "../../base-command.js";

interface ExistingPage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  position: number;
  progress_calculation_method: string;
  completion_seconds: number | null;
}

async function resolveHtmlActivityId(
  client: CodleClient,
  activityId: string,
): Promise<string> {
  const resp = await client.request(
    "GET",
    `/api/v1/activities/${activityId}`,
    { params: { include: "activitiable" } },
  );
  const actData = (resp.data as Record<string, unknown>) || {};
  const relationships =
    (actData.relationships as Record<string, unknown>) || {};
  const activitiable =
    (relationships.activitiable as Record<string, unknown>) || {};
  const rel = (activitiable.data as Record<string, unknown>) || {};
  const id = String(rel.id || "");
  const rawType = String(rel.type || "");
  if (!id || !rawType)
    throw new Error(
      `활동 ${activityId}에서 activitiable을 찾을 수 없습니다.`,
    );
  const type = rawType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  if (type !== "HtmlActivity")
    throw new Error(
      `활동 ${activityId}의 유형이 ${type}입니다. HtmlActivity만 지원합니다.`,
    );
  return id;
}

async function getExistingPages(
  client: CodleClient,
  htmlActivityId: string,
): Promise<ExistingPage[]> {
  const resp = await client.request(
    "GET",
    `/api/v1/html_activities/${htmlActivityId}`,
    { params: { include: "html_activity_pages" } },
  );
  const pages = extractIncluded(
    resp as {
      included?: Array<{
        type?: string;
        id?: string;
        attributes?: Record<string, unknown>;
      }>;
    },
    "html_activity_page",
  );
  return pages
    .map((p) => ({
      id: String(p.id),
      url: String(p.url || ""),
      width: p.width != null ? Number(p.width) : null,
      height: p.height != null ? Number(p.height) : null,
      position: Number(p.position ?? 0),
      progress_calculation_method: String(
        p.progress_calculation_method || "no_calculation",
      ),
      completion_seconds:
        p.completion_seconds != null
          ? Number(p.completion_seconds)
          : null,
    }))
    .sort((a, b) => a.position - b.position);
}

interface DesiredPage {
  url: string;
  width?: number;
  height?: number;
  progress_calculation_method?: string;
  completion_seconds?: number;
}

export default class HtmlActivityPageSync extends BaseCommand {
  static description =
    "HtmlActivity의 페이지 목록을 동기화합니다.";

  static flags = {
    "activity-id": Flags.string({
      required: true,
      description: "활동 ID",
    }),
    pages: Flags.string({
      required: true,
      description:
        '페이지 목록 JSON [{url, width?, height?, progress_calculation_method?, completion_seconds?}]',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(HtmlActivityPageSync);

    const desiredPages: DesiredPage[] = JSON.parse(flags.pages);
    const htmlActivityId = await resolveHtmlActivityId(
      this.client,
      flags["activity-id"],
    );
    const existingPages = await getExistingPages(
      this.client,
      htmlActivityId,
    );

    const dataToCreate: Array<{ attributes: Record<string, unknown> }> =
      [];
    const dataToUpdate: Array<{
      id: string;
      attributes: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < desiredPages.length; i++) {
      const desired = desiredPages[i];
      const pcm =
        desired.progress_calculation_method ?? "time";
      const completionSeconds =
        desired.completion_seconds ??
        (pcm === "time" ? 3 : null);

      const attrs: Record<string, unknown> = {
        url: desired.url,
        position: i,
        progress_calculation_method: pcm,
      };
      if (desired.width != null) attrs.width = desired.width;
      if (desired.height != null) attrs.height = desired.height;
      if (completionSeconds != null)
        attrs.completion_seconds = completionSeconds;

      if (i < existingPages.length) {
        const existing = existingPages[i];
        const needsUpdate =
          existing.url !== desired.url ||
          existing.position !== i ||
          existing.progress_calculation_method !== pcm ||
          existing.completion_seconds !== completionSeconds ||
          (desired.width != null && existing.width !== desired.width) ||
          (desired.height != null &&
            existing.height !== desired.height);
        if (needsUpdate) {
          dataToUpdate.push({ id: existing.id, attributes: attrs });
        }
      } else {
        attrs.html_activity_id = htmlActivityId;
        dataToCreate.push({ attributes: attrs });
      }
    }

    const dataToDestroy: Array<{ id: string }> = [];
    for (let i = desiredPages.length; i < existingPages.length; i++) {
      dataToDestroy.push({ id: existingPages[i].id });
    }

    if (
      !dataToCreate.length &&
      !dataToUpdate.length &&
      !dataToDestroy.length
    ) {
      this.log("변경 사항이 없습니다.");
      return;
    }

    await this.client.request(
      "POST",
      "/api/v1/html_activity_pages/do_many",
      {
        json: {
          data_to_create: dataToCreate,
          data_to_update: dataToUpdate,
          data_to_destroy: dataToDestroy,
        },
      },
    );

    const parts: string[] = [
      `HtmlActivityPages 동기화 완료 (html_activity=${htmlActivityId})`,
    ];
    if (dataToCreate.length)
      parts.push(`추가: ${dataToCreate.length}건`);
    if (dataToUpdate.length)
      parts.push(`수정: ${dataToUpdate.length}건`);
    if (dataToDestroy.length)
      parts.push(`삭제: ${dataToDestroy.length}건`);
    this.log(parts.join(" / "));
  }
}
