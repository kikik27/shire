import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const roots = [
  "app/candidate",
  "app/recruiter",
  "app/admin",
  "components/admin",
  "components/ai",
  "components/applications",
  "components/dashboard",
  "components/layout",
  "components/profile",
  "components/site",
  "components/wallet",
  "lib/auth",
  "lib/wallet",
];
const forbidden = [
  "@/lib/seed",
  "@/lib/dashboard-data",
  "@/lib/store",
  "@/store",
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(target)
        : /\.(?:ts|tsx)$/.test(entry.name)
          ? [target]
          : [];
    }),
  );
  return files.flat();
}

test("authenticated code does not import demo domain data", async () => {
  const webRoot = path.resolve(import.meta.dirname, "..");
  const files = (
    await Promise.all(roots.map((root) => sourceFiles(path.join(webRoot, root))))
  ).flat();
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const moduleName of forbidden) {
      if (source.includes(`"${moduleName}`) || source.includes(`'${moduleName}`)) {
        violations.push(`${path.relative(webRoot, file)} -> ${moduleName}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
