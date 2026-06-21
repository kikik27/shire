import assert from "node:assert/strict";
import test from "node:test";

import { CandidateProfileDraftSchema } from "../src/runtime/candidate-profile";
import { generateCandidateProfile } from "../src/runtime/cv-agent-generator";

const profile = CandidateProfileDraftSchema.parse({
  fullName: "Maya Okafor",
  headline: "Frontend Engineer",
  skills: ["TypeScript"],
  profileConfidence: 0.9,
});

test("generates a structured candidate profile with model capability context", async () => {
  const calls: Array<{ messages: unknown; options: any }> = [];
  const result = await generateCandidateProfile({
    agent: {
      generate: async (messages: unknown, options: unknown) => {
        calls.push({ messages, options });
        return {
          object: profile,
          response: { modelId: "openrouter/test-model" },
          usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
        };
      },
    },
    candidateId: "candidate-001",
    jobId: "job-1",
    rawCv: "Maya Okafor. Senior TypeScript engineer",
  });

  assert.equal(result.profile.fullName, "Maya Okafor");
  assert.equal(result.model, "openrouter/test-model");
  assert.equal(result.usage?.totalTokens, 42);
  assert.equal(
    calls[0]?.options.requestContext.get("model-capability"),
    "cv-normalization",
  );
  assert.equal(calls[0]?.options.memory.thread, "cv-parse:candidate-001");
  assert.match(JSON.stringify(calls[0]?.messages), /Senior TypeScript engineer/);
});

test("removes profile facts that are not grounded in the CV", async () => {
  const result = await generateCandidateProfile({
    agent: {
      generate: async () => ({
        object: CandidateProfileDraftSchema.parse({
          fullName: "Maya Okafor",
          headline: "Frontend Engineer",
          skills: ["TypeScript", "Rust"],
          workExperience: [
            { company: "Shopify", role: "Frontend Engineer" },
          ],
          portfolioUrl: "https://invented.example",
          profileConfidence: 0.95,
        }),
        response: { modelId: "openrouter/test-model" },
      }),
    },
    candidateId: "candidate-001",
    jobId: "job-1",
    rawCv: "Maya Okafor. Frontend Engineer. TypeScript.",
  });

  assert.deepEqual(result.profile.skills, ["TypeScript"]);
  assert.deepEqual(result.profile.workExperience, []);
  assert.equal(result.profile.portfolioUrl, undefined);
  assert.ok(result.profile.missingFields.includes("workExperience"));
});
