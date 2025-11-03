import { connect } from "nats";
import type { NatsConnection, KV, NatsError } from "nats";

let ncPromise: Promise<NatsConnection> | null = null;
let kvPromise: Promise<KV> | null = null;

const NATS_URL = process.env.NATS_URL || "nats://localhost:4222";
const KV_BUCKET = process.env.NATS_KV_BUCKET_NONCE || "WEB_AUTH_NONCE";

async function getConnection(): Promise<NatsConnection> {
  if (!ncPromise) {
    ncPromise = connect({ servers: NATS_URL });
  }
  return ncPromise;
}

export async function getNonceKV(): Promise<KV> {
  if (!kvPromise) {
    kvPromise = (async () => {
      const nc = await getConnection();
      const jsm = await nc.jetstreamManager();
      // Ensure bucket exists (idempotent)
      try {
        const jsmAny = jsm as unknown as {
          kv?: { addBucket: (opts: unknown) => Promise<unknown> };
        };
        await jsmAny.kv?.addBucket({
          bucket: KV_BUCKET,
          history: 1,
          max_value_size: 1024,
        });
      } catch (e) {
        const ne = e as NatsError;
        // 409 is already exists
        if (!(ne.code === "409" || /already exists/i.test(String(e)))) {
          throw e;
        }
      }
      const js = nc.jetstream();
      return await js.views.kv(KV_BUCKET);
    })();
  }
  return kvPromise;
}

export async function putNonce(nonce: string, ttlMs: number): Promise<void> {
  const kv = await getNonceKV();
  const enc = new TextEncoder();
  // Per-entry ttl not supported in current typings; rely on bucket policy or external cleanup
  await kv.put(nonce, enc.encode("1"));
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  const kv = await getNonceKV();
  const e = await kv.get(nonce);
  if (!e?.value) return false;
  await kv.delete(nonce);
  return true;
}
