import "dotenv/config";

const strip = (v: string) => v.replace(/\/$/, "");

export const config = {
  apiUrl: strip(process.env.CODLE_API_URL || "https://class.dev.codle.io"),
  port: parseInt(process.env.CODLE_PORT || "3000", 10),
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
  publicUrl: strip(
    process.env.CODLE_MCP_PUBLIC_URL || "https://mcp.dev.codle.io",
  ),
  authServerUrl: strip(
    process.env.CODLE_AUTH_SERVER_URL || "https://user.dev.codle.io",
  ),
};
