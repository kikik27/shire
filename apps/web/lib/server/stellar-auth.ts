import { Keypair } from "@stellar/stellar-sdk";

/**
 * Verify a Stellar (ed25519) signature produced by Freighter's `signMessage`.
 *
 * Flow: the client asks Freighter to sign a challenge string, producing a
 * signature. We reconstruct the signer's Keypair from the Stellar public key
 * (G...) and verify the signature over the original challenge bytes.
 */

const SIGN_IN_PREFIX = "Shire sign-in @";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export type StellarChallengeInput = {
  /** The signer's Stellar public key (G...). */
  address: string;
  /** The exact message string that was signed. */
  message: string;
  /** The signature returned by the wallet. Hex or base64 string. */
  signature: string;
};

export class StellarAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StellarAuthError";
  }
}

/**
 * Build a fresh sign-in challenge with a timestamp. Sent to the client, which
 * forwards it to Freighter's signMessage, then back here for verification.
 */
export function buildSignInMessage(): string {
  return `${SIGN_IN_PREFIX}${new Date().toISOString()}`;
}

/**
 * Validate that a challenge message is well-formed and recent.
 * @returns the timestamp parsed from the message, or throws if invalid/expired.
 */
function validateChallenge(message: string): Date {
  if (!message.startsWith(SIGN_IN_PREFIX)) {
    throw new StellarAuthError("Invalid sign-in message format.");
  }
  const stamp = message.slice(SIGN_IN_PREFIX.length).trim();
  const issued = new Date(stamp);
  if (Number.isNaN(issued.getTime())) {
    throw new StellarAuthError("Invalid sign-in timestamp.");
  }
  const age = Date.now() - issued.getTime();
  if (age > MAX_AGE_MS) {
    throw new StellarAuthError("Sign-in message has expired. Please try again.");
  }
  // Reject future-dated challenges (clock skew / replay).
  if (issued.getTime() - Date.now() > 30_000) {
    throw new StellarAuthError("Sign-in timestamp is in the future.");
  }
  return issued;
}

/**
 * Decode a signature string to raw bytes. Freighter may return hex or base64.
 * We try hex first (Freighter's typical format) and fall back to base64.
 */
function decodeSignature(signature: string): Uint8Array {
  const trimmed = signature.trim();
  // Hex (64-byte ed25519 signature = 128 hex chars).
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 128) {
    return Buffer.from(trimmed, "hex");
  }
  // Base64 fallback.
  return Buffer.from(trimmed, "base64");
}

/**
 * Verify that `signature` was produced by `address`'s private key over
 * `message`. Returns true on success.
 *
 * @throws {StellarAuthError} if the message is malformed/expired, the address
 *   is not a valid Stellar public key, or the signature does not verify.
 */
export function verifyStellarChallenge(input: StellarChallengeInput): boolean {
  const { address, message, signature } = input;

  validateChallenge(message);

  let keypair: Keypair;
  try {
    // In this stellar-sdk version, fromPublicKey accepts the G... string and
    // decodes it internally. Throws if the key is invalid.
    keypair = Keypair.fromPublicKey(address);
  } catch {
    throw new StellarAuthError("Invalid Stellar address.");
  }

  const messageBytes = Buffer.from(message, "utf8");
  const signatureBytes = Buffer.from(decodeSignature(signature));

  try {
    return keypair.verify(messageBytes, signatureBytes);
  } catch {
    return false;
  }
}
