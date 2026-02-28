import "dotenv/config";

export const config = {
  apiUrl: (process.env.CODLE_API_URL || "https://class.dev.codle.io").replace(
    /\/$/,
    ""
  ),
  port: parseInt(process.env.CODLE_PORT || "3000", 10),
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
  publicUrl: (
    process.env.CODLE_MCP_PUBLIC_URL || "https://mcp.dev.codle.io"
  ).replace(/\/$/, ""),
  authServerUrl: (
    process.env.CODLE_AUTH_SERVER_URL || "https://user.dev.codle.io"
  ).replace(/\/$/, ""),
};
