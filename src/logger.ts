import { config } from "./config.js";

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

const LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

const currentLevel =
  LEVELS[(config.logLevel.toUpperCase() as LogLevel) || "INFO"] ?? LEVELS.INFO;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (LEVELS[level] >= currentLevel) {
    console.error(`${timestamp()} [${level}] codle_mcp:`, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => log("DEBUG", ...args),
  info: (...args: unknown[]) => log("INFO", ...args),
  warn: (...args: unknown[]) => log("WARNING", ...args),
  error: (...args: unknown[]) => log("ERROR", ...args),
};
