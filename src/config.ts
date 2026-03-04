import "dotenv/config";

const env = (key: string, fallback: string) =>
  (process.env[key] || fallback).replace(/\/$/, "");

export const config = {
  apiUrl: env("CODLE_API_URL", "https://class.dev.codle.io"),
  port: parseInt(process.env.CODLE_PORT || "3000", 10),
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
  publicUrl: env("CODLE_MCP_PUBLIC_URL", "https://mcp.dev.codle.io"),
  authServerUrl: env("CODLE_AUTH_SERVER_URL", "https://user.dev.codle.io"),
};
