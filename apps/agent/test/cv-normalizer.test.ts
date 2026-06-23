import assert from "node:assert/strict";
import test from "node:test";

import { runCvParseJob } from "../src/jobs/run-cv-parse";
import {
  CandidateProfileDraftSchema,
  buildCandidateEmbeddingText,
} from "../src/runtime/cv/candidate-profile";
import {
  normalizeCvWithFallback,
  processCandidateCv,
} from "../src/runtime/cv/normalizer";
import { InMemoryCandidateProfileStore } from "../src/runtime/data/candidate-profile-store";

const profile = CandidateProfileDraftSchema.parse({
  fullName: "Maya Okafor",
  headline: "Frontend Engineer",
  skills: ["TypeScript", "React"],
  workExperience: [],
  education: [],
  preferredRoles: ["Product Engineer"],
  location: "Jakarta",
  workPreference: "REMOTE",
  profileConfidence: 0.91,
  missingFields: [],
});

test("builds stable canonical text for candidate embeddings", () => {
  assert.equal(
    buildCandidateEmbeddingText(profile),
    [
      "Headline: Frontend Engineer",
      "Skills: TypeScript, React",
      "Preferred roles: Product Engineer",
      "Location: Jakarta",
      "Work preference: REMOTE",
    ].join("\n"),
  );
});

test("stores a pending-review profile and its embedding separately", async () => {
  const store = new InMemoryCandidateProfileStore();
  await store.saveDraft({
    id: "candidate-1",
    status: "PENDING_REVIEW",
    profile,
    embeddingText: "canonical text",
    embedding: [0.1, 0.2],
    usage: [],
  });

  assert.equal((await store.getById("candidate-1"))?.status, "PENDING_REVIEW");
});

test("retries CV normalization twice before failing over to the final attempt", async () => {
  const attempts: string[] = [];
  const result = await normalizeCvWithFallback({
    rawCv: "Maya CV",
    generate: async () => {
      attempts.push("attempt");
      if (attempts.length < 3) {
        return { profile: {}, model: "openrouter/model" };
      }
      return { profile, model: "openrouter/model" };
    },
  });

  assert.equal(attempts.length, 3);
  assert.equal(result.profile.fullName, "Maya Okafor");
  assert.equal(result.attempts.length, 2);
});

test("normalizes, embeds, and stores a reviewable profile without raw CV", async () => {
  const store = new InMemoryCandidateProfileStore();
  const result = await processCandidateCv({
    candidateId: "candidate-1",
    rawCv: "RAW PRIVATE CV",
    store,
    generate: async () => ({
      profile,
      model: "openrouter/qwen",
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    }),
    embed: async () => ({ embedding: [0.1, 0.2] }),
  });

  const saved = await store.getById("candidate-1");
  assert.equal(result.status, "PENDING_REVIEW");
  assert.deepEqual(saved?.embedding, [0.1, 0.2]);
  assert.doesNotMatch(saved?.embeddingText ?? "", /RAW PRIVATE CV/);
  assert.equal(saved?.usage[0]?.provider, "openrouter");
  assert.equal(saved?.usage[0]?.capability, "cv-normalization");
});

test("CV parse job exposes persisted profile and embedding metadata", async () => {
  const store = new InMemoryCandidateProfileStore();
  const result = await runCvParseJob({
    store,
    generate: async () => ({ profile, model: "openrouter/qwen" }),
    embed: async () => ({ embedding: [0.1, 0.2] }),
  });

  assert.equal(result.profile.status, "PENDING_REVIEW");
  assert.equal(result.profile.embeddingDimensions, 2);
  assert.equal(
    (await store.getById("candidate-001"))?.profile.fullName,
    "Maya Okafor",
  );
});
