import { env } from "../env";

export type StorageDiagnostics = {
  memory: StorageTargetDiagnostics;
  knowledge: StorageTargetDiagnostics;
  knowledgeManifest: StorageTargetDiagnostics;
};

type StorageTargetDiagnostics = {
  scheme: string;
  persistent: boolean;
  authConfigured: boolean;
};

function resolveScheme(url: string) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  return match?.[1].toLowerCase() ?? "unknown";
}

function isPersistentScheme(scheme: string) {
  return !["file", "memory", "unknown"].includes(scheme);
}

function describeStorage(url: string, authToken: string | undefined) {
  const scheme = resolveScheme(url);

  return {
    scheme,
    persistent: isPersistentScheme(scheme),
    authConfigured: Boolean(authToken?.trim()),
  };
}

export function getStorageDiagnostics(
  runtime: Pick<
    typeof env,
    | "agentMemoryUrl"
    | "agentMemoryAuthToken"
    | "agentKnowledgeUrl"
    | "agentKnowledgeAuthToken"
    | "agentKnowledgeManifestUrl"
    | "agentKnowledgeManifestAuthToken"
  > = env,
): StorageDiagnostics {
  return {
    memory: describeStorage(
      runtime.agentMemoryUrl,
      runtime.agentMemoryAuthToken,
    ),
    knowledge: describeStorage(
      runtime.agentKnowledgeUrl,
      runtime.agentKnowledgeAuthToken,
    ),
    knowledgeManifest: describeStorage(
      runtime.agentKnowledgeManifestUrl,
      runtime.agentKnowledgeManifestAuthToken,
    ),
  };
}
