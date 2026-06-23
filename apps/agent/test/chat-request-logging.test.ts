import assert from "node:assert/strict";
import test from "node:test";

import { summarizeChatRequestBody } from "../src/runtime/chat/request-logging";

test("summarizes a chat request body clearly", () => {
  assert.deepEqual(
    summarizeChatRequestBody({
      scope: {
        viewerId: "candidate-001",
        role: "candidate",
        resourceType: "job",
        resourceId: "job_fe_aperture",
        resourceLabel: "Senior Frontend Engineer",
        threadId: "candidate:candidate-001:job:job_fe_aperture",
        resourceKey: "candidate:candidate-001:job:job_fe_aperture",
        scope: "resource",
      },
      messages: [{ role: "user", content: "hello" }],
      memory: {
        thread: "candidate:candidate-001:job:job_fe_aperture",
        resource: "candidate:candidate-001:job:job_fe_aperture",
      },
      context: [{ role: "system", content: "Viewer: candidate-001" }],
      system: "Viewer: candidate-001\nRole: candidate",
    }),
    {
      hasContext: true,
      hasMessages: true,
      messageCount: 1,
      systemLength: 37,
      scope: {
        viewerId: "candidate-001",
        role: "candidate",
        resourceType: "job",
        resourceId: "job_fe_aperture",
        resourceLabel: "Senior Frontend Engineer",
        threadId: "candidate:candidate-001:job:job_fe_aperture",
        resourceKey: "candidate:candidate-001:job:job_fe_aperture",
        scope: "resource",
      },
      memory: {
        thread: "candidate:candidate-001:job:job_fe_aperture",
        resource: "candidate:candidate-001:job:job_fe_aperture",
      },
    },
  );
});

test("summarizes non-object bodies safely", () => {
  assert.deepEqual(summarizeChatRequestBody(null), { bodyType: "object" });
});
