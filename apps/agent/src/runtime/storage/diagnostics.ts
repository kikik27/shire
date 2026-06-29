import { env } from "../../env";

export type StorageDiagnostics = {
  memory: StorageTargetDiagnostics;
  knowledge: StorageTargetDiagnostics;
  knowledgeManifest: StorageTargetDiagnostics;
};

export type StorageReadinessResult =
  | { ready: true }
  | { ready: false; reason: string };

type StorageReadinessDependencies = {
  pingLibSql?: (url: string, authToken?: string) => Promise<boolean>;
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

/**
 * Probe whether each configured store is reachable.
 *
 * Local `file:` stores are always considered ready (they are accessed in
 * process and created lazily). Remote libSQL stores are pinged with a trivial
 * `SELECT 1` query through an ephemeral client. The first unreachable remote
 * store fails fast with a reason; everything else is treated as ready so a
 * transient probe hiccup never marks the whole service down unnecessarily.
 */
export async function probeStorageReadiness(
  runtime: Pick<
    typeof env,
    | "agentMemoryUrl"
    | "agentMemoryAuthToken"
    | "agentKnowledgeUrl"
    | "agentKnowledgeAuthToken"
    | "agentKnowledgeManifestUrl"
    | "agentKnowledgeManifestAuthToken"
  > = env,
  dependencies: StorageReadinessDependencies = {},
): Promise<StorageReadinessResult> {
  const targets: Array<{ label: string; url: string; authToken?: string }> = [
    { label: "memory", url: runtime.agentMemoryUrl, authToken: runtime.agentMemoryAuthToken },
    { label: "knowledge", url: runtime.agentKnowledgeUrl, authToken: runtime.agentKnowledgeAuthToken },
    {
      label: "knowledgeManifest",
      url: runtime.agentKnowledgeManifestUrl,
      authToken: runtime.agentKnowledgeManifestAuthToken,
    },
  ];

  for (const target of targets) {
    const scheme = resolveScheme(target.url);
    // Local in-process stores are always reachable from this process.
    if (!isPersistentScheme(scheme)) {
      continue;
    }

    const reachable = await (
      dependencies.pingLibSql ?? pingLibSql
    )(target.url, target.authToken);
    if (!reachable) {
      return {
        ready: false,
        reason: `${target.label} store unreachable at ${scheme} endpoint`,
      };
    }
  }

  return { ready: true };
}

async function pingLibSql(url: string, authToken?: string): Promise<boolean> {
  // Lazy import so unit tests that never hit /ready do not pay the cost.
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken });
  try {
    await client.execute("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    client.close();
  }
}
