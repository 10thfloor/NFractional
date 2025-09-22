import {
  connect,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  StorageType,
  RetentionPolicy,
  DiscardPolicy,
} from "nats";
import client from "prom-client";

type RawEvent = {
  network: string;
  blockHeight: number;
  txIndex: number;
  evIndex: number;
  txId: string;
  contract: { name: string; address: string };
  type: string;
  payload: Record<string, unknown>;
};

// Fractional event payloads (flattened by ingestor)
type VaultCreatedPayload = {
  vaultId: string;
  collection: string;
  tokenId: string | number;
  shareSymbol: string;
  policy: unknown;
  creator: string;
};

type BuyoutProposedPayload = {
  vaultId: string;
  proposalId: string | number;
  proposer: string;
  asset: string;
  amount: string | number;
  quorumPercent: string | number;
  supportPercent: string | number;
  expiresAt: string | number;
};

type NormEventBase = {
  network: string;
  blockHeight: number;
  txIndex: number;
  evIndex: number;
  txId: string;
};

// Generic normalized event to cover all Fractional types
type NormEvent = NormEventBase & {
  type: string;
  vaultId?: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "string";
}

function hasNumberOrString(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  return typeof v === "string" || typeof v === "number";
}

type FractionalRawEvent<
  T extends string,
  P extends Record<string, unknown>
> = RawEvent & {
  contract: { name: "Fractional"; address: string };
  type: T;
  payload: P;
};

function isFractional(
  raw: RawEvent
): raw is FractionalRawEvent<string, Record<string, unknown>> {
  return raw.contract.name === "Fractional";
}

function isVaultCreatedPayload(
  p: Record<string, unknown>
): p is VaultCreatedPayload {
  return (
    hasString(p, "vaultId") &&
    hasString(p, "collection") &&
    hasNumberOrString(p, "tokenId") &&
    hasString(p, "shareSymbol") &&
    // policy can be anything
    hasString(p, "creator")
  );
}

function isBuyoutProposedPayload(
  p: Record<string, unknown>
): p is BuyoutProposedPayload {
  return (
    hasString(p, "vaultId") &&
    hasNumberOrString(p, "proposalId") &&
    hasString(p, "proposer") &&
    hasString(p, "asset") &&
    hasNumberOrString(p, "amount") &&
    hasNumberOrString(p, "quorumPercent") &&
    hasNumberOrString(p, "supportPercent") &&
    hasNumberOrString(p, "expiresAt")
  );
}

function isFractionalVaultCreated(
  raw: RawEvent
): raw is FractionalRawEvent<"VaultCreated", VaultCreatedPayload> {
  return (
    isFractional(raw) &&
    raw.type === "VaultCreated" &&
    isRecord(raw.payload) &&
    isVaultCreatedPayload(raw.payload)
  );
}

function isFractionalBuyoutProposed(
  raw: RawEvent
): raw is FractionalRawEvent<"BuyoutProposed", BuyoutProposedPayload> {
  return (
    isFractional(raw) &&
    raw.type === "BuyoutProposed" &&
    isRecord(raw.payload) &&
    isBuyoutProposedPayload(raw.payload)
  );
}

const ENV = {
  NETWORK: process.env.NETWORK || "emulator",
  NATS_URL: process.env.NATS_URL || "nats://nats:4222",
  DURABLE: process.env.DURABLE || "normalizer",
};

function decodeBase64Json<T = unknown>(maybeBase64Json: unknown): T | null {
  if (typeof maybeBase64Json !== "string") return null;
  try {
    const json = Buffer.from(maybeBase64Json, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function flattenCadenceFieldsShape(
  value: unknown
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const inner = (value as { value?: unknown }).value;
  const maybe = isRecord(inner) ? inner : value;
  const fields = (maybe as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  const out: Record<string, unknown> = {};
  for (const f of fields as unknown[]) {
    if (isRecord(f) && typeof f.name === "string") {
      const rv = (f as { value?: unknown }).value;
      out[f.name] =
        isRecord(rv) && "value" in rv ? (rv as { value: unknown }).value : rv;
    }
  }
  return out;
}

function mapFractional(raw: RawEvent): NormEvent | null {
  if (!isFractional(raw)) return null;

  // Handle payload that may be a base64 JSON-CDC string or an object
  let payload: Record<string, unknown> | null = null;
  if (typeof (raw as { payload?: unknown }).payload === "string") {
    const decoded = decodeBase64Json(
      (raw as unknown as { payload: string }).payload
    );
    const flat =
      flattenCadenceFieldsShape(decoded) ||
      (isRecord(decoded) ? (decoded as Record<string, unknown>) : null);
    payload = flat;
  } else if (isRecord(raw.payload)) {
    // Default generic mapping for all Fractional events
    payload = { ...(raw.payload as Record<string, unknown>) } as Record<
      string,
      unknown
    >;
    // Decode JSON-CDC when present under nested payload and flatten to KV
    const embedded = (payload as { payload?: unknown }).payload;
    if (typeof embedded === "string") {
      const decoded = decodeBase64Json(embedded);
      const flat =
        flattenCadenceFieldsShape(decoded) ||
        (isRecord(decoded) ? decoded : undefined);
      if (flat) payload = flat as Record<string, unknown>;
    } else {
      const flat = flattenCadenceFieldsShape(payload);
      if (flat) payload = flat;
    }
  }
  if (!payload) return null;

  // Event-specific payload normalization
  // - SharesMinted.mints: convert JSON-CDC array of structs into [{account, amount}]
  if (raw.type === "SharesMinted") {
    const mints = payload.mints as unknown;
    if (Array.isArray(mints)) {
      const toKV = (v: unknown): Record<string, unknown> | null => {
        if (!isRecord(v)) return null;
        // Shapes seen: {type:"Struct", value:{fields:[{name, value:{value}}]}}
        const value = (v as Record<string, unknown>).value;
        const fieldsCandidate = isRecord(value)
          ? (value as Record<string, unknown>).fields
          : (v as Record<string, unknown>).fields;
        const fields = Array.isArray(fieldsCandidate)
          ? (fieldsCandidate as unknown[])
          : [];
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          if (isRecord(f) && typeof f.name === "string") {
            const rv = (f as Record<string, unknown>).value;
            out[f.name as string] =
              isRecord(rv) && "value" in rv
                ? (rv as { value: unknown }).value
                : rv;
          }
        }
        return Object.keys(out).length > 0 ? out : null;
      };
      const norm = mints
        .map((item) => {
          if (isRecord(item)) {
            if ("account" in item || "amount" in item) return item;
            const kv = toKV(item);
            return kv ?? item;
          }
          return item;
        })
        .map((it) => {
          if (!isRecord(it)) return it;
          const account =
            (it.account as unknown) ?? (it as Record<string, unknown>)["0"];
          const amount =
            (it.amount as unknown) ?? (it as Record<string, unknown>)["1"];
          return { account, amount };
        });
      payload.mints = norm as unknown;
    }
  }
  const vaultIdMaybe = payload.vaultId;
  const vaultId =
    typeof vaultIdMaybe === "string"
      ? vaultIdMaybe
      : typeof vaultIdMaybe === "number"
      ? String(vaultIdMaybe)
      : undefined;

  return {
    network: raw.network,
    type: raw.type,
    vaultId,
    blockHeight: raw.blockHeight,
    txIndex: raw.txIndex,
    evIndex: raw.evIndex,
    txId: raw.txId,
    payload,
  };
}

// AMM: ConstantProductAMM mapper
function isAMM(raw: RawEvent): boolean {
  return raw.contract.name === "ConstantProductAMM";
}

function mapAMM(raw: RawEvent): NormEvent | null {
  if (!isAMM(raw)) return null;
  // Payload may be string (base64 JSON-CDC) or object with embedded JSON-CDC in value/fields
  let payload: Record<string, unknown> | null = null;
  if (typeof (raw as { payload?: unknown }).payload === "string") {
    const decoded = decodeBase64Json(
      (raw as unknown as { payload: string }).payload
    );
    const flat =
      flattenCadenceFieldsShape(decoded) ||
      (isRecord(decoded) ? (decoded as Record<string, unknown>) : null);
    payload = flat;
  } else if (isRecord(raw.payload)) {
    payload = { ...(raw.payload as Record<string, unknown>) };
    // Try flattening common JSON-CDC shapes
    const embedded = (payload as { payload?: unknown }).payload;
    if (typeof embedded === "string") {
      const decoded = decodeBase64Json(embedded);
      const flat =
        flattenCadenceFieldsShape(decoded) ||
        (isRecord(decoded) ? decoded : undefined);
      if (flat) payload = flat as Record<string, unknown>;
    } else {
      const flat = flattenCadenceFieldsShape(payload);
      if (flat) payload = flat;
    }
  }
  if (!payload) return null;

  const vaultIdMaybe = (payload as { vaultId?: unknown }).vaultId;
  const vaultId =
    typeof vaultIdMaybe === "string"
      ? vaultIdMaybe
      : typeof vaultIdMaybe === "number"
      ? String(vaultIdMaybe)
      : undefined;

  return {
    network: raw.network,
    type: raw.type,
    vaultId,
    blockHeight: raw.blockHeight,
    txIndex: raw.txIndex,
    evIndex: raw.evIndex,
    txId: raw.txId,
    payload: Object.assign({}, payload as Record<string, unknown>, {
      // propagate owner for PoolCreated; later stages may use it to persist pool owner
      owner: (raw as any)?.contract?.address,
    }),
  };
}

async function main() {
  const registry = new client.Registry();
  client.collectDefaultMetrics({
    register: registry,
    prefix: "app_flow_normalizer_",
  });
  const normalized = new client.Counter({
    name: "app_flow_normalizer_events_published_total",
    help: "NORM events published",
    registers: [registry],
    labelNames: ["event"],
  });

  const nc = await connect({ servers: ENV.NATS_URL });
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  // Ensure streams exist before creating consumers
  try {
    await jsm.streams.info("FLOW_EVENTS_RAW");
  } catch {
    console.log("[normalizer] Creating stream FLOW_EVENTS_RAW");
    await jsm.streams.add({
      name: "FLOW_EVENTS_RAW",
      subjects: ["flow.events.raw.*.>"],
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
      max_bytes: 536870912,
      discard: DiscardPolicy.Old,
      duplicate_window: 120000000000, // 120s in nanoseconds
      num_replicas: 1,
    });
  }

  try {
    await jsm.streams.info("FLOW_EVENTS_NORM");
  } catch {
    console.log("[normalizer] Creating stream FLOW_EVENTS_NORM");
    await jsm.streams.add({
      name: "FLOW_EVENTS_NORM",
      subjects: ["flow.events.norm.*.>"],
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
      max_bytes: 536870912,
      discard: DiscardPolicy.Old,
      duplicate_window: 120000000000, // 120s in nanoseconds
      num_replicas: 1,
    });
  }

  const stream = "FLOW_EVENTS_RAW";
  const durable = ENV.DURABLE;
  // Consume all RAW events; we'll map only contracts we recognize
  const filter = `flow.events.raw.${ENV.NETWORK}.>`;

  console.log("[normalizer] consumer config", { stream, durable, filter });

  try {
    const info = await jsm.consumers.info(stream, durable);
    const currentFilter = (
      info as unknown as { config?: { filter_subject?: string } }
    )?.config?.filter_subject;
    if (currentFilter !== filter) {
      try {
        await jsm.consumers.delete(stream, durable);
      } catch {}
      await jsm.consumers.add(stream, {
        durable_name: durable,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
        filter_subject: filter,
      });
    }
  } catch {
    await jsm.consumers.add(stream, {
      durable_name: durable,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      replay_policy: ReplayPolicy.Instant,
      filter_subject: filter,
    });
  }

  const consumer = await js.consumers.get(stream, durable);
  const messages = await consumer.consume({});

  for await (const m of messages) {
    try {
      console.log("[normalizer] received", m.subject);
      const text = m.string();
      if (typeof text !== "string" || text.trim().charAt(0) !== "{") {
        console.warn("[normalizer] skip non-JSON payload", {
          subject: m.subject,
        });
        m.ack();
        continue;
      }
      let raw: RawEvent;
      try {
        raw = JSON.parse(text) as RawEvent;
      } catch (e) {
        console.warn("[normalizer] skip unparsable JSON", {
          subject: m.subject,
          error: e,
        });
        m.ack();
        continue;
      }
      const normFrac = mapFractional(raw);
      if (normFrac) {
        const subj = `flow.events.norm.${normFrac.network}.fractional.${normFrac.type}`;
        console.log("[normalizer] publish", subj);
        await js.publish(subj, JSON.stringify(normFrac));
        normalized.inc({ event: normFrac.type });
      }
      const normAmm = mapAMM(raw);
      if (normAmm) {
        const subj = `flow.events.norm.${normAmm.network}.amm.${normAmm.type}`;
        console.log("[normalizer] publish", subj);
        await js.publish(subj, JSON.stringify(normAmm));
        normalized.inc({ event: normAmm.type });
      }
      // Handle DistributionHandler events generically
      if (raw.contract.name === "DistributionHandler") {
        let payload: Record<string, unknown> | null = null;
        if (typeof (raw as { payload?: unknown }).payload === "string") {
          const decoded = decodeBase64Json(
            (raw as unknown as { payload: string }).payload
          );
          const flat =
            flattenCadenceFieldsShape(decoded) ||
            (isRecord(decoded) ? (decoded as Record<string, unknown>) : null);
          payload = flat;
        } else if (isRecord(raw.payload)) {
          payload = { ...(raw.payload as Record<string, unknown>) };
          const embedded = (payload as { payload?: unknown }).payload;
          if (typeof embedded === "string") {
            const decoded = decodeBase64Json(embedded);
            const flat =
              flattenCadenceFieldsShape(decoded) ||
              (isRecord(decoded) ? decoded : undefined);
            if (flat) payload = flat as Record<string, unknown>;
          } else {
            const flat = flattenCadenceFieldsShape(payload);
            if (flat) payload = flat;
          }
        }
        if (payload) {
          const normHandler: NormEvent = {
            network: raw.network,
            type: raw.type,
            vaultId:
              typeof payload.vaultId === "string" ? payload.vaultId : undefined,
            blockHeight: raw.blockHeight,
            txIndex: raw.txIndex,
            evIndex: raw.evIndex,
            txId: raw.txId,
            payload,
          };
          const subj = `flow.events.norm.${normHandler.network}.distributionhandler.${normHandler.type}`;
          console.log("[normalizer] publish", subj);
          await js.publish(subj, JSON.stringify(normHandler));
          normalized.inc({ event: normHandler.type });
        }
      }
      m.ack();
    } catch (e) {
      console.error("normalize error", e);
      m.ack();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
