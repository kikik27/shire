export const autonomyModes = [
  "manual",
  "semi-autonomous",
  "fully-autonomous",
] as const;

export type AutonomyMode = (typeof autonomyModes)[number];

export const defaultAutonomyMode: AutonomyMode = "semi-autonomous";

function isAutonomyMode(value: string): value is AutonomyMode {
  return (autonomyModes as readonly string[]).includes(value);
}

export function parseAutonomyMode(value: string | undefined): AutonomyMode {
  const normalized = value?.trim();

  if (normalized === undefined || normalized === "") {
    return defaultAutonomyMode;
  }

  if (isAutonomyMode(normalized)) {
    return normalized;
  }

  throw new Error(`Unsupported autonomy mode: ${value}`);
}
