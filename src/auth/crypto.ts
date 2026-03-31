import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import { hostname, userInfo } from "node:os";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha256";

export interface EncryptedData {
  iv: string;
  tag: string;
  ciphertext: string;
  salt: string;
}

export function getMachineId(): string {
  return `${hostname()}:${userInfo().username}`;
}

export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST,
  );
}

export function encrypt(plaintext: string): EncryptedData {
  const salt = randomBytes(16);
  const key = deriveKey(getMachineId(), salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    salt: salt.toString("base64"),
  };
}

export function decrypt(data: EncryptedData): string {
  const salt = Buffer.from(data.salt, "base64");
  const key = deriveKey(getMachineId(), salt);
  const iv = Buffer.from(data.iv, "base64");
  const tag = Buffer.from(data.tag, "base64");
  const ciphertext = Buffer.from(data.ciphertext, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function generateCodeVerifier(): string {
  const unreserved =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = randomBytes(32);
  return Array.from(bytes)
    .map((b) => unreserved[b % unreserved.length])
    .join("");
}

export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}
