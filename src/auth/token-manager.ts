import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../logger.js";
import { decrypt, encrypt, type EncryptedData } from "./crypto.js";

export interface StoredCredentials {
  auth_server_url: string;
  client_id: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  created_at: number;
  expires_in: number;
}

// AIDEV-NOTE: 함수로 평가해야 한다. 모듈 레벨 상수로 만들면
// E2E global-setup에서 import 후 CODLE_CONFIG_DIR을 설정해도 반영되지 않는다.
function getConfigDir(): string {
  return process.env.CODLE_CONFIG_DIR ?? join(homedir(), ".config", "codle");
}

function getCredentialsFile(): string {
  return join(getConfigDir(), "credentials.json");
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function save(credentials: StoredCredentials): void {
  ensureConfigDir();
  const encrypted = encrypt(JSON.stringify(credentials));
  writeFileSync(getCredentialsFile(), JSON.stringify(encrypted), {
    mode: 0o600,
  });
}

export function load(): StoredCredentials | null {
  const file = getCredentialsFile();
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const encrypted: EncryptedData = JSON.parse(raw);
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted) as StoredCredentials;
  } catch {
    logger.warn("저장된 인증 정보를 읽을 수 없습니다. 재로그인이 필요합니다.");
    return null;
  }
}

export function clear(): void {
  const file = getCredentialsFile();
  if (existsSync(file)) {
    unlinkSync(file);
  }
}

export function isExpired(credentials: StoredCredentials): boolean {
  const expiresAt = (credentials.created_at + credentials.expires_in) * 1000;
  return Date.now() >= expiresAt;
}

export async function refresh(
  tokenEndpoint: string,
  clientId: string,
  refreshToken: string,
): Promise<StoredCredentials | null> {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    logger.warn("토큰 갱신 실패 (HTTP %d)", response.status);
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;
  const existing = load();

  const updated: StoredCredentials = {
    auth_server_url: existing?.auth_server_url ?? "",
    client_id: clientId,
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string) ?? refreshToken,
    scope: (data.scope as string) ?? "public",
    created_at: (data.created_at as number) ?? Math.floor(Date.now() / 1000),
    expires_in: (data.expires_in as number) ?? 7200,
  };

  save(updated);
  return updated;
}
