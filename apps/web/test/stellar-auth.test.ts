import assert from "node:assert/strict";
import test from "node:test";

import { hash, Keypair } from "@stellar/stellar-sdk";

import {
  buildSignInMessage,
  StellarAuthError,
  verifyStellarChallenge,
} from "../lib/server/stellar-auth";

/**
 * verifyStellarChallenge must reconstruct the exact preimage Freighter's
 * `signMessage` signs. The extension (signBlob → encodeSep53Message) signs
 *
 *   sha256( "Stellar Signed Message:\n" + message )
 *
 * NOT the raw bytes and NOT sha256(message). Verifying against either of those
 * silently rejects every real Freighter signature → login 401 → because the
 * session cookie never gets set, every downstream API call 401s too. These
 * tests lock in the SEP-53 preimage and the raw-bytes compatibility path.
 */

const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

/** A challenge string stamped "now" so validateChallenge() accepts it. */
function freshChallenge() {
  // buildSignInMessage already prefixes the timestamp; bypass it so the message
  // is exactly what we sign, while still matching the server's expected format.
  return `Shire sign-in @${new Date().toISOString()}`;
}

/** Hex/base64 signature the way Freighter hands it back to the client. */
function signOver(kp: Keypair, preimage: Buffer, encoding: "hex" | "base64") {
  return kp.sign(preimage).toString(encoding);
}

/** The exact preimage Freighter's signMessage signs (encodeSep53Message). */
function freighterPreimage(message: string): Buffer {
  return hash(
    Buffer.concat([
      Buffer.from(SIGN_MESSAGE_PREFIX, "utf8"),
      Buffer.from(message, "utf8"),
    ]),
  );
}

test("verifies a real Freighter signMessage signature (sha256 of prefix+message)", () => {
  const kp = Keypair.random();
  const message = freshChallenge();

  const ok = verifyStellarChallenge({
    address: kp.publicKey(),
    message,
    signature: signOver(kp, freighterPreimage(message), "base64"),
  });

  assert.equal(ok, true);
});

test("still verifies a signature over the raw message bytes (compat)", () => {
  const kp = Keypair.random();
  const message = freshChallenge();
  const messageBytes = Buffer.from(message, "utf8");

  const ok = verifyStellarChallenge({
    address: kp.publicKey(),
    message,
    signature: signOver(kp, messageBytes, "hex"),
  });

  assert.equal(ok, true);
});

test("rejects a signature from a different key", () => {
  const signer = Keypair.random();
  const attacker = Keypair.random();
  const message = freshChallenge();

  const ok = verifyStellarChallenge({
    address: signer.publicKey(),
    message,
    signature: signOver(attacker, freighterPreimage(message), "base64"),
  });

  assert.equal(ok, false);
});

test("rejects a signature over the wrong message", () => {
  const kp = Keypair.random();
  const message = freshChallenge();
  const wrongMessage = "Shire sign-in @1985-01-01T00:00:00.000Z";

  const ok = verifyStellarChallenge({
    address: kp.publicKey(),
    message,
    signature: signOver(kp, freighterPreimage(wrongMessage), "base64"),
  });

  assert.equal(ok, false);
});

test("throws on a malformed challenge message", () => {
  const kp = Keypair.random();

  assert.throws(
    () =>
      verifyStellarChallenge({
        address: kp.publicKey(),
        message: "not a shire challenge",
        signature: signOver(kp, freighterPreimage("not a shire challenge"), "base64"),
      }),
    StellarAuthError,
  );
});

test("throws on an expired challenge (>5 min old)", () => {
  const kp = Keypair.random();
  const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const message = `Shire sign-in @${stale}`;

  assert.throws(
    () =>
      verifyStellarChallenge({
        address: kp.publicKey(),
        message,
        signature: signOver(kp, freighterPreimage(message), "base64"),
      }),
    StellarAuthError,
  );
});

test("buildSignInMessage produces a prefixed, ISO-timestamped challenge", () => {
  const message = buildSignInMessage();
  assert.match(message, /^Shire sign-in @\d{4}-\d{2}-\d{2}T.+Z$/);
});
