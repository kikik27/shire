export type LibSQLRuntimeConfig = {
  id: string;
  url: string;
  authToken?: string;
};

export function buildLibSQLRuntimeConfig(config: LibSQLRuntimeConfig) {
  const authToken = config.authToken?.trim();

  return authToken
    ? { id: config.id, url: config.url, authToken }
    : { id: config.id, url: config.url };
}
