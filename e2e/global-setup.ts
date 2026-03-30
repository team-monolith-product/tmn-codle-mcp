import { rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { save, clear } from "../src/auth/token-manager.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(SCRIPT_DIR, "..");
const TMP_CONFIG = resolve(SCRIPT_DIR, ".e2e-config.tmp.json");
const E2E_CONFIG_DIR = resolve(SCRIPT_DIR, ".e2e-credentials.tmp");

dotenv.config({ path: resolve(PROJECT_DIR, ".env.e2e") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required in .env.e2e`);
  }
  return value;
}

async function createUserAndGetToken(): Promise<{
  userId: string;
  accessToken: string;
}> {
  const tenantNumber = requireEnv("E2E_TENANT_NUMBER");
  const clientId = requireEnv("E2E_USER_CLIENT_ID");
  const userRailsUrl = `https://user.${tenantNumber}.e2e.codle.io`;

  const timestamp = Date.now();
  const email = `cli-e2e-${timestamp}@codle.io`;
  const password = "password";

  const createRes = await fetch(`${userRailsUrl}/e2e/factory/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory: "user",
      attributes: {
        email,
        password,
        user_type: "teacher",
        name: "CLI E2E",
        user_association: "E2E School",
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `Factory create failed: ${createRes.status} ${await createRes.text()}`,
    );
  }
  const { data: user } = (await createRes.json()) as { data: { id: string } };

  const tokenRes = await fetch(`${userRailsUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      client_id: clientId,
      username: email,
      password,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(
      `Token request failed: ${tokenRes.status} ${await tokenRes.text()}`,
    );
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return { userId: user.id, accessToken: access_token };
}

export async function setup(): Promise<void> {
  const { userId, accessToken } = await createUserAndGetToken();

  // AIDEV-NOTE: Problems API 등 교사 전용 엔드포인트에 teacher_levels가 필요하다.
  // subscription_grant factory의 기본 trait(:active)이 start_at/end_at을 넓게 잡아 항상 active이다.
  const tenantNumber = requireEnv("E2E_TENANT_NUMBER");
  const classRailsUrl = `https://class.${tenantNumber}.e2e.codle.io`;
  const grantRes = await fetch(`${classRailsUrl}/e2e/factory/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory: "subscription_grant",
      attributes: { user_id: userId },
    }),
  });
  if (!grantRes.ok) {
    throw new Error(
      `subscription_grant creation failed: ${
        grantRes.status
      } ${await grantRes.text()}`,
    );
  }

  const codleBin = resolve(PROJECT_DIR, "bin", "run.js");

  // AIDEV-NOTE: --token 플래그 제거 이후, E2E에서는 credential 파일에 직접 저장하여 CLI가 인식하도록 한다.
  // CODLE_CONFIG_DIR로 e2e/ 하위 임시 경로를 지정하여 사용자의 실제 credential을 보호한다.
  process.env.CODLE_CONFIG_DIR = E2E_CONFIG_DIR;
  const clientId = requireEnv("E2E_USER_CLIENT_ID");
  save({
    auth_server_url: `https://user.${tenantNumber}.e2e.codle.io`,
    client_id: clientId,
    access_token: accessToken,
    refresh_token: "",
    scope: "public",
    created_at: Math.floor(Date.now() / 1000),
    expires_in: 3600,
  });

  writeFileSync(
    TMP_CONFIG,
    JSON.stringify(
      {
        e2e: { userId, accessToken, codleBin },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  console.log("E2E global setup complete.");
}

export function teardown(): void {
  try {
    unlinkSync(TMP_CONFIG);
  } catch {
    /* already removed */
  }
  try {
    rmSync(E2E_CONFIG_DIR, { recursive: true });
  } catch {
    /* already removed */
  }
}
