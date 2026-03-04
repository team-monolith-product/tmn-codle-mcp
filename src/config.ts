import "dotenv/config";

export const config = {
  apiUrl: (process.env.CODLE_API_URL || "https://class.dev.codle.io").replace(
    /\/$/,
    "",
  ),
  port: parseInt(process.env.CODLE_PORT || "3000", 10),
  logLevel: process.env.CODLE_LOG_LEVEL || "INFO",
};
