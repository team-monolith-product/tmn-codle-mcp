import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(SCRIPT_DIR, "..");
const MCP_PORT = 3000;
const MAX_BUDGET = process.env.MAX_BUDGET || "1.00";
const TMP_CONFIG = resolve(SCRIPT_DIR, "mcp-config.tmp.json");

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const TIMESTAMP = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const RESULT_DIR = resolve(SCRIPT_DIR, "results", TIMESTAMP);

// --- Env ---

dotenv.config({ path: resolve(PROJECT_DIR, ".env.e2e") });
const E2E_TENANT_NUMBER = requireEnv("E2E_TENANT_NUMBER");
const E2E_USER_CLIENT_ID = requireEnv("E2E_USER_CLIENT_ID");
const USER_RAILS_URL = `https://user.${E2E_TENANT_NUMBER}.e2e.codle.io`;

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`ERROR: ${key} is required in .env.e2e`);
    process.exit(1);
  }
  return value;
}

// --- Process management ---

function startMcpServer() {
  const child = spawn("node", ["dist/index.js"], {
    cwd: PROJECT_DIR,
    env: { ...process.env, DOTENV_CONFIG_PATH: ".env.e2e" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  child.on("error", (err) => {
    console.error("MCP server failed to start:", err.message);
    process.exit(1);
  });
  return child;
}

async function waitForHealth(retries = 20) {
  console.log(`Waiting for MCP server on port ${MCP_PORT}...`);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${MCP_PORT}/health`);
      if (res.ok) { console.log("MCP server ready."); return; }
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("MCP server did not become ready in time.");
}

// --- Auth ---

async function createUserAndGetToken() {
  const email = `mcp-e2e-${TIMESTAMP}@codle.io`;
  const password = "password";

  console.log(`Creating E2E user: ${email}`);
  const createRes = await fetch(`${USER_RAILS_URL}/e2e/factory/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factory: "user",
      attributes: { email, password, user_type: "teacher", name: "MCP E2E", user_association: "E2E School" },
    }),
  });
  if (!createRes.ok) throw new Error(`Factory create failed: ${createRes.status} ${await createRes.text()}`);
  console.log("E2E user created.");

  console.log("Obtaining access token...");
  const tokenRes = await fetch(`${USER_RAILS_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "password", client_id: E2E_USER_CLIENT_ID, username: email, password }),
  });
  if (!tokenRes.ok) throw new Error(`Token request failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();
  console.log("Access token obtained.");
  return access_token;
}

// --- Claude ---

function runClaude() {
  const promptTemplate = readFileSync(resolve(SCRIPT_DIR, "prompt.md"), "utf-8");
  const prompt = promptTemplate.replaceAll("__TIMESTAMP__", TIMESTAMP);

  const stdoutStream = createWriteStream(resolve(RESULT_DIR, "raw.ndjson"));
  const stderrStream = createWriteStream(resolve(RESULT_DIR, "stderr.log"));

  return new Promise((ok, fail) => {
    const child = spawn("claude", [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--mcp-config", TMP_CONFIG,
      "--strict-mcp-config",
      "--allowed-tools", "mcp__codle__*",
      "--max-budget-usd", MAX_BUDGET,
      "--no-session-persistence",
      "--model", "sonnet",
    ], {
      cwd: PROJECT_DIR,
      env: { ...process.env, CLAUDECODE: undefined },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.pipe(stdoutStream);
    child.stderr.pipe(stderrStream);
    child.on("error", fail);
    child.on("close", async (code) => {
      await Promise.all([finished(stdoutStream), finished(stderrStream)]);
      ok(code);
    });
  });
}

// --- Main ---

mkdirSync(RESULT_DIR, { recursive: true });

const mcpServer = startMcpServer();

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { mcpServer.kill(); } catch { /* already exited */ }
  try { unlinkSync(TMP_CONFIG); } catch { /* already removed */ }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });

try {
  const [, accessToken] = await Promise.all([
    waitForHealth(),
    createUserAndGetToken(),
  ]);

  writeFileSync(TMP_CONFIG, JSON.stringify({
    mcpServers: {
      codle: {
        type: "http",
        url: `http://localhost:${MCP_PORT}/mcp`,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  }, null, 2), { mode: 0o600 });

  console.log("=== Codle MCP E2E Test ===");
  console.log(`Timestamp: ${TIMESTAMP}`);
  console.log(`Budget:    $${MAX_BUDGET}`);
  console.log(`Results:   ${RESULT_DIR}`);
  console.log("=========================");

  await runClaude();

  console.log(`\nRaw output saved to ${RESULT_DIR}/raw.ndjson`);
  console.log(`Stderr log saved to ${RESULT_DIR}/stderr.log`);

  // Generate report
  const code = await new Promise((ok, fail) => {
    const child = spawn("bash", [resolve(SCRIPT_DIR, "parse-result.sh"), RESULT_DIR], { stdio: "inherit" });
    child.on("error", fail);
    child.on("close", ok);
  });
  if (code !== 0) throw new Error(`parse-result.sh exited with code ${code}`);
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
