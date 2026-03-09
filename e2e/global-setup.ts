import { spawn, type ChildProcess } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(SCRIPT_DIR, "..");
const MCP_PORT = 3000;
const TMP_CONFIG = resolve(SCRIPT_DIR, ".mcp-config.tmp.json");

dotenv.config({ path: resolve(PROJECT_DIR, ".env.e2e") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required in .env.e2e`);
  }
  return value;
}

let mcpServer: ChildProcess | undefined;

function startMcpServer(): ChildProcess {
  const child = spawn("node", ["dist/index.js"], {
    cwd: PROJECT_DIR,
    env: { ...process.env, DOTENV_CONFIG_PATH: ".env.e2e" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  child.on("error", (err) => {
    throw new Error(`MCP server failed to start: ${err.message}`);
  });
  return child;
}

async function waitForHealth(retries = 20): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${MCP_PORT}/health`);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("MCP server did not become ready in time.");
}

async function createUserAndGetToken(): Promise<{
  userId: string;
  accessToken: string;
}> {
  const tenantNumber = requireEnv("E2E_TENANT_NUMBER");
  const clientId = requireEnv("E2E_USER_CLIENT_ID");
  const userRailsUrl = `https://user.${tenantNumber}.e2e.codle.io`;

  const timestamp = Date.now();
  const email = `mcp-e2e-${timestamp}@codle.io`;
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
        name: "MCP E2E",
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
  mcpServer = startMcpServer();

  const [, { userId, accessToken }] = await Promise.all([
    waitForHealth(),
    createUserAndGetToken(),
  ]);

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

  writeFileSync(
    TMP_CONFIG,
    JSON.stringify(
      {
        mcpServers: {
          codle: {
            type: "http",
            url: `http://localhost:${MCP_PORT}/mcp`,
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        },
        e2e: { userId },
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
    mcpServer?.kill();
  } catch {
    /* already exited */
  }
  try {
    unlinkSync(TMP_CONFIG);
  } catch {
    /* already removed */
  }
}
