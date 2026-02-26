import "dotenv/config";

export const config = {
  apiUrl: (process.env.CODLE_API_URL || "https://class.dev.codle.io").replace(
    /\/$/,
    ""
  ),
  authUrl: (process.env.CODLE_AUTH_URL || "").replace(/\/$/, ""),
  email: process.env.CODLE_EMAIL || "",
  password: process.env.CODLE_PASSWORD || "",
  clientId: process.env.CODLE_CLIENT_ID || "",
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
};
