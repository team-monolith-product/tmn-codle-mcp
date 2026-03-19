import "dotenv/config";

type Config = {
  apiUrl: string;
  logLevel: string;
};

const defaults: Config = {
  apiUrl: "https://class.dev.codle.io",
  logLevel: "INFO",
};

function e2eOverrides(tenant: string): Partial<Config> {
  return {
    apiUrl: `https://class.${tenant}.e2e.codle.io`,
  };
}

function envOverrides(): Partial<Config> {
  return {
    ...(process.env.CODLE_API_URL && {
      apiUrl: process.env.CODLE_API_URL,
    }),
    ...(process.env.CODLE_LOG_LEVEL && {
      logLevel: process.env.CODLE_LOG_LEVEL,
    }),
  };
}

const tenant = process.env.E2E_TENANT_NUMBER;

export const config: Config = {
  ...defaults,
  ...(tenant && e2eOverrides(tenant)),
  ...envOverrides(),
};
