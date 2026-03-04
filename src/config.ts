import "dotenv/config";

const tenant = process.env.E2E_TENANT_NUMBER;
const domain = tenant ? `${tenant}.e2e.codle.io` : "dev.codle.io";

const env = (key: string, fallback: string) =>
  (process.env[key] || fallback).replace(/\/$/, "");

export const config = {
  apiUrl: env("CODLE_API_URL", `https://class.${domain}`),
  port: parseInt(process.env.CODLE_PORT || "3000", 10),
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
  publicUrl: env("CODLE_MCP_PUBLIC_URL", `https://mcp.${domain}`),
  authServerUrl: env("CODLE_AUTH_SERVER_URL", `https://user.${domain}`),
};
