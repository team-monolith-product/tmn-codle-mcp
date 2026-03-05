import "dotenv/config";

type Config = {
  apiUrl: string;
  port: number;
  logLevel: string;
  publicUrl: string;
  authServerUrl: string;
};

const defaults: Config = {
  apiUrl: "https://class.dev.codle.io",
  port: 3000,
  logLevel: "INFO",
  publicUrl: "https://mcp.dev.codle.io",
  authServerUrl: "https://user.dev.codle.io",
};

function e2eOverrides(tenant: string): Partial<Config> {
  return {
    apiUrl: `https://class.${tenant}.e2e.codle.io`,
    publicUrl: `https://mcp.${tenant}.e2e.codle.io`,
    authServerUrl: `https://user.${tenant}.e2e.codle.io`,
  };
}

function envOverrides(): Partial<Config> {
  return {
    ...(process.env.CODLE_API_URL && {
      apiUrl: process.env.CODLE_API_URL,
    }),
    ...(process.env.CODLE_PORT && {
      port: parseInt(process.env.CODLE_PORT, 10),
    }),
    ...(process.env.CODLE_LOG_LEVEL && {
      logLevel: process.env.CODLE_LOG_LEVEL,
    }),
    ...(process.env.CODLE_MCP_PUBLIC_URL && {
      publicUrl: process.env.CODLE_MCP_PUBLIC_URL,
    }),
    ...(process.env.CODLE_AUTH_SERVER_URL && {
      authServerUrl: process.env.CODLE_AUTH_SERVER_URL,
    }),
  };
}

const tenant = process.env.E2E_TENANT_NUMBER;

export const config: Config = {
  ...defaults,
  ...(tenant && e2eOverrides(tenant)),
  ...envOverrides(),
};
