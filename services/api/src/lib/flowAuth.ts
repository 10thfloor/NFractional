import elliptic from "elliptic";
import { SHA3 } from "sha3";

// Builds a local P-256 authorizer for emulator/dev environments.
// Returns an FCL authorization function usable as proposer/payer/authorizer.
export function makeLocalAuth(
  addrHexWith0x: string,
  privateKeyHexWith0x: string,
  keyIndex = 0
) {
  const addrNo0x = addrHexWith0x.replace(/^0x/, "");
  const pkHex = privateKeyHexWith0x.replace(/^0x/, "");

  return async (acct: any) => {
    return {
      ...acct,
      tempId: `${addrNo0x}-${keyIndex}`,
      addr: addrNo0x,
      keyId: keyIndex,
      signingFunction: getSigningFunction(addrNo0x, pkHex, keyIndex),
    };
  };
}

export function getLocalAuthTriplet(
  addrHexWith0x: string,
  privateKeyHexWith0x: string,
  keyIndex = 0
) {
  const auth = makeLocalAuth(addrHexWith0x, privateKeyHexWith0x, keyIndex);
  // FCL types expect AccountAuthorization/AuthorizationFn, but our local builder
  // satisfies the shape at runtime. Cast narrowly here to avoid propagating any.
  return {
    proposer: auth as any,
    payer: auth as any,
    authorizations: [auth] as any,
  };
}

export function getSigningFunction(
  addrNo0x: string,
  pkHex: string,
  keyIndex: number
) {
  return async (signable: any) => {
    if (!pkHex || pkHex.trim().length === 0) {
      throw new Error(
        "FRACTIONAL_PLATFORM_ADMIN_KEY is empty. Set a valid hex private key in env."
      );
    }
    const normalizedPkHex = pkHex.replace(/^0x/, "").toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalizedPkHex)) {
      throw new Error(
        "FRACTIONAL_PLATFORM_ADMIN_KEY must be a hex string (optionally 0x-prefixed)."
      );
    }
    const msg = Buffer.from(signable.message, "hex");
    const hasher = new SHA3(256);
    hasher.update(msg);
    const digest = hasher.digest();
    const EC = (elliptic as unknown as { ec: new (curve: string) => any }).ec;
    const ec = new EC("p256");
    const key = ec.keyFromPrivate(normalizedPkHex, "hex");
    const signature = key.sign(Buffer.from(digest));
    const r = signature.r.toArrayLike(Buffer, "be", 32);
    const s = signature.s.toArrayLike(Buffer, "be", 32);
    const sigHex = Buffer.concat([r, s]).toString("hex");
    return { addr: addrNo0x, keyId: keyIndex, signature: sigHex };
  };
}
