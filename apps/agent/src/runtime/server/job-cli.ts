import { pathToFileURL } from "node:url";

export function runJobCli<T>(
  importMetaUrl: string,
  runJob: () => Promise<T>,
) {
  const isDirectRun =
    process.argv[1] !== undefined &&
    importMetaUrl === pathToFileURL(process.argv[1]).href;

  if (!isDirectRun) {
    return;
  }

  runJob()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
