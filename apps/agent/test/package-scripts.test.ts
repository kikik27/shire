import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("runtime scripts load the agent .env file", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  for (const scriptName of [
    "dev",
    "start",
    "job:cv-parse",
    "job:job-matching",
    "job:knowledge-sync",
    "job:talent-matching",
    "job:onchain-sync",
    "job:dispute-summary",
  ]) {
    assert.match(
      packageJson.scripts[scriptName],
      /--env-file-if-exists=\.env/,
      `${scriptName} must load apps/agent/.env`,
    );
  }

  for (const dependency of [
    "@ai-sdk/openai-compatible",
    "@openrouter/ai-sdk-provider",
  ]) {
    assert.equal(packageJson.dependencies[dependency], undefined);
  }
});

test("default tests isolate environment while live queue tests load .env", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    scripts: Record<string, string>;
  };
  const testIndex = await readFile(
    new URL("./index.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(packageJson.scripts.test, /--env-file/);
  assert.match(
    packageJson.scripts["test:live-queue"],
    /--env-file-if-exists=\.env/,
  );
  assert.match(testIndex, /^import "\.\/test-env";/);
});

test("onchain job script prints its result when run directly", () => {
  const agentDirectory = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/jobs/run-onchain-sync.ts"],
    {
      cwd: agentDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        TOKENROUTER_API_KEY: "test-tokenrouter-api-key",
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(result.stdout.trim(), "");

  const output = JSON.parse(result.stdout) as { job?: string };
  assert.equal(output.job, "onchain-sync");
});
