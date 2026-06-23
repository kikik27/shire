import { timingSafeEqual } from "node:crypto";

export function hasValidServiceToken(
  authorization: string | undefined,
  expectedToken: string | undefined,
) {
  if (!authorization?.startsWith("Bearer ") || !expectedToken) {
    return false;
  }

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
