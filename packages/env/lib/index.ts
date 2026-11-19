import { config } from '@dotenvx/dotenvx';

export const baseEnv =
  config({
    path: `${import.meta.dirname}/../../../../.env`,
  }).parsed ?? {};

const isDev = baseEnv.CLI_CEB_DEV === 'true' || baseEnv.CEB_DEV === 'true' || process.env['CLI_CEB_DEV'] === 'true';

export const dynamicEnvValues = {
  NODE_ENV: isDev ? 'development' : 'production',
  CEB_NODE_ENV: isDev ? 'development' : 'production',
} as const;
