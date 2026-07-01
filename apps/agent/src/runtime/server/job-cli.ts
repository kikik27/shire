import { pathToFileURL } from "node:url";

export function runJobCli<T>(
  importMetaUrl: string,
  runJob: (args: readonly string[]) => Promise<T>,
) {
  const isDirectRun =
    process.argv[1] !== undefined &&
    importMetaUrl === pathToFileURL(process.argv[1]).href;

  if (!isDirectRun) {
    return;
  }

  runJob(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
