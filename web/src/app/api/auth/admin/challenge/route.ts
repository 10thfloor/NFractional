import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { putNonce } from "@/lib/kvNonce";

type NonceRecord = { exp: number };
const NONCE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Simple in-memory nonce store for single-instance dev. For multi-instance, use Redis/KV.
const memoryStore = globalThis as unknown as {
  __admin_nonce_store__?: Map<string, NonceRecord>;
};
if (!memoryStore.__admin_nonce_store__) {
  memoryStore.__admin_nonce_store__ = new Map<string, NonceRecord>();
}
const store = memoryStore.__admin_nonce_store__!;

export async function GET(_req: NextRequest) {
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

  const nonce = crypto.randomBytes(32).toString("hex");
  const issuedAt = Date.now();
  const exp = issuedAt + NONCE_TTL_MS;

  const challengeObj = {
    purpose: "admin-sign",
    origin: appOrigin,
    nonce,
    issuedAt,
    exp,
  } as const;
  const challenge = JSON.stringify(challengeObj);

  try {
    // Store nonce in NATS KV with TTL
    await putNonce(nonce, NONCE_TTL_MS);
  } catch (_e) {
    // Fallback to in-memory for local-only if NATS is unavailable
    store.set(nonce, { exp });
    setTimeout(() => store.delete(nonce), NONCE_TTL_MS + 5000);
  }

  const res = NextResponse.json({ challenge });
  res.cookies.set("admin_sign_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.ceil(NONCE_TTL_MS / 1000),
    path: "/",
  });
  return res;
}
