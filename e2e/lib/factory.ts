import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";

const PROJECT_DIR = resolve(import.meta.dirname, "..", "..");
dotenv.config({ path: resolve(PROJECT_DIR, ".env.e2e") });

const tenantNumber = process.env.E2E_TENANT_NUMBER;
if (!tenantNumber) {
  throw new Error("E2E_TENANT_NUMBER is required in .env.e2e");
}

const USER_RAILS_URL = `https://user.${tenantNumber}.e2e.codle.io`;
const CLASS_RAILS_URL = `https://class.${tenantNumber}.e2e.codle.io`;
const CONFIG_PATH = resolve(import.meta.dirname, "..", ".mcp-config.tmp.json");

const USER_RAILS_FACTORIES = ["user", "experience"];

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakecaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

interface TmpConfig {
  mcpServers: { codle: { headers: { Authorization: string } } };
  e2e: { userId: string };
}

function readConfig(): TmpConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as TmpConfig;
}

export class TestFactory {
  private sequence = 0;
  private _userId: string | undefined;

  /** global-setup에서 생성한 E2E 유저 ID */
  get userId(): string {
    if (!this._userId) {
      this._userId = readConfig().e2e.userId;
    }
    return this._userId;
  }

  async create<T extends { id: string } = { id: string }>(
    factory: string,
    attributes: Record<string, unknown> = {},
  ): Promise<T> {
    this.sequence += 1;
    const baseUrl = USER_RAILS_FACTORIES.includes(factory)
      ? USER_RAILS_URL
      : CLASS_RAILS_URL;

    const response = await fetch(`${baseUrl}/e2e/factory/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factory,
        attributes: snakecaseKeys(attributes),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Factory creation failed for "${factory}": ${response.status} - ${errorText}`,
      );
    }

    const result = (await response.json()) as { data: T };
    return result.data;
  }
}

// --- 편의 함수 ---

interface Material {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

/** E2E 유저 소유의 자료를 생성한다. */
export async function createMaterial(
  factory: TestFactory,
  overrides: Record<string, unknown> = {},
): Promise<Material> {
  return factory.create<Material>("material", {
    name: `e2e-mcp-material-${Date.now()}`,
    userId: factory.userId,
    ...overrides,
  });
}

/** E2E 유저 소유 자료에 활동을 생성한다. */
export async function createActivity(
  factory: TestFactory,
  materialId: string,
  overrides: Record<string, unknown> = {},
): Promise<Activity> {
  return factory.create<Activity>("activity", {
    name: `e2e-mcp-activity-${Date.now()}`,
    materialId,
    ...overrides,
  });
}
