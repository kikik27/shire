export type KnowledgeCorpus = "repository" | "product";
export type ProductKnowledgeAudience =
  | "general"
  | "candidate"
  | "recruiter";

export type KnowledgeSource = {
  path: string;
  priority: number;
  corpus: KnowledgeCorpus;
  audience?: ProductKnowledgeAudience;
};

export const repositoryKnowledgeSources = [
  { path: ".agent/context/architecture.md", priority: 0, corpus: "repository" },
  {
    path: ".agent/context/agent/orchestration.md",
    priority: 1,
    corpus: "repository",
  },
  {
    path: ".agent/context/agent/runtime-context.md",
    priority: 2,
    corpus: "repository",
  },
  {
    path: ".agent/context/agent/workflows.md",
    priority: 3,
    corpus: "repository",
  },
  {
    path: ".agent/context/agent/matching-pipeline.md",
    priority: 4,
    corpus: "repository",
  },
  { path: ".agent/context/agent/api.md", priority: 5, corpus: "repository" },
  { path: ".agent/context/auth/README.md", priority: 6, corpus: "repository" },
  {
    path: ".agent/context/schemas/README.md",
    priority: 7,
    corpus: "repository",
  },
  {
    path: ".agent/context/onchain/README.md",
    priority: 8,
    corpus: "repository",
  },
  { path: ".agent/decisions/log.md", priority: 9, corpus: "repository" },
] as const satisfies readonly KnowledgeSource[];

export const productKnowledgeSources = [
  {
    path: ".agent/knowledge/product/shire-general.md",
    priority: 0,
    corpus: "product",
    audience: "general",
  },
  {
    path: ".agent/knowledge/product/shire-candidate.md",
    priority: 1,
    corpus: "product",
    audience: "candidate",
  },
  {
    path: ".agent/knowledge/product/shire-recruiter.md",
    priority: 2,
    corpus: "product",
    audience: "recruiter",
  },
] as const satisfies readonly KnowledgeSource[];

export const knowledgeSources = [
  ...repositoryKnowledgeSources,
  ...productKnowledgeSources,
] as const;
