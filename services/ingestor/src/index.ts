import { connect, StringCodec } from "nats";
import client from "prom-client";
import * as fcl from "@onflow/fcl";

type RawEvent = {
  network: string;
  blockHeight: number;
  txIndex: number;
  evIndex: number;
  txId: string;
  contract: { name: string; address: string };
  type: string;
  payload: unknown;
};

// Flow Access REST v1 event response types (partial, only fields we use)
type CadenceField = { name: string; value: unknown };
type AccessEvent = {
  type: string;
  transaction_id?: string;
  transaction_index?: number | string;
  event_index?: number | string;
  payload?: unknown;
  value?: { fields?: CadenceField[] };
};
type AccessEventsResultItem = {
  block_height: number | string;
  events?: AccessEvent[];
};
type AccessEventsResponse = {
  results?: AccessEventsResultItem[];
};
type AccessEventNormalized = {
  blockHeight: number;
  transactionId: string;
  transactionIndex: number;
  eventIndex: number;
  type: string;
  payload: unknown;
  value?: { fields?: CadenceField[] };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isCadenceField(value: unknown): value is CadenceField {
  return (
    isRecord(value) &&
    typeof (value as { name?: unknown }).name === "string" &&
    "value" in value
  );
}

const ENV = {
  NETWORK: process.env.NETWORK || "emulator",
  NATS_URL: process.env.NATS_URL || "nats://nats:4222",
  FLOW_ACCESS: process.env.FLOW_ACCESS || "http://host.docker.internal:8888",
  START_HEIGHT: Number(process.env.START_HEIGHT || 0),
  POLL_MS: Number(process.env.POLL_MS || 1500),
  BATCH: Number(process.env.BATCH || 250),
  EVENT_TYPES: (process.env.EVENT_TYPES || "").split(",").filter(Boolean),
  RESET_CHECKPOINT: process.env.RESET_CHECKPOINT === "1",
  // ALLOW_SYNTHETIC: process.env.ALLOW_SYNTHETIC === "1",
  // SYNTHETIC_VAULT_ID: process.env.SYNTHETIC_VAULT_ID || "vlt-synth",
  // SYNTHETIC_SYMBOL: process.env.SYNTHETIC_SYMBOL || "EX42",
};

async function main() {
  // Metrics
  const registry = new client.Registry();
  client.collectDefaultMetrics({
    register: registry,
    prefix: "app_flow_ingestor_",
  });
  const published = new client.Counter({
    name: "app_flow_ingestor_events_published_total",
    help: "RAW events published",
    registers: [registry],
    labelNames: ["event"],
  });

  // NATS
  const nc = await connect({ servers: ENV.NATS_URL });
  const js = nc.jetstream();

  // FCL config
  fcl.config().put("accessNode.api", ENV.FLOW_ACCESS);

  const kv = await js.views.kv("FLOW_INDEX_CHKPT");

  // Optional: reset checkpoint to START_HEIGHT by deleting the KV key
  if (ENV.RESET_CHECKPOINT) {
    try {
      await kv.delete(`${ENV.NETWORK}.ingestor`);
      console.log("[ingestor] checkpoint reset requested; KV key deleted");
    } catch (e) {
      console.warn("[ingestor] checkpoint reset failed (continuing)", e);
    }
  }

  const rawSubject = (contract: string, ev: string) =>
    `flow.events.raw.${ENV.NETWORK}.${contract}.${ev}`;

  console.log("[ingestor] config", {
    FLOW_ACCESS: ENV.FLOW_ACCESS,
    NETWORK: ENV.NETWORK,
    EVENT_TYPES: ENV.EVENT_TYPES,
  });

  const getCheckpoint = async (): Promise<number> => {
    const e = await kv
      .get(`${ENV.NETWORK}.ingestor`)
      .catch((e) => console.warn("checkpoint not found!", e));
    return e?.string() ? Number(e.string()) : ENV.START_HEIGHT;
  };

  const setCheckpoint = async (h: number) => {
    const delays = [0, 250, 750, 1500];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);
      try {
        const sc = StringCodec();
        await kv.put(`${ENV.NETWORK}.ingestor`, sc.encode(String(h)));
        console.log("[ingestor] checkpoint updated", h);
        return;
      } catch (err) {
        if (i === delays.length - 1) {
          console.warn(
            "[ingestor] checkpoint update failed after retries (will continue)",
            err
          );
        }
      }
    }
  };

  let cursor = await getCheckpoint();
  if (ENV.EVENT_TYPES.length === 0) {
    console.warn("No EVENT_TYPES provided; nothing to ingest.");
  }

  // // Optional: publish one synthetic RAW event to enable smoke test without Flow
  // if (ENV.ALLOW_SYNTHETIC) {
  //   setTimeout(async () => {
  //     try {
  //       const body: RawEvent = {
  //         network: ENV.NETWORK,
  //         blockHeight: 1,
  //         txIndex: 0,
  //         evIndex: 0,
  //         txId: "t-ingestor-synthetic",
  //         contract: { name: "Fractional", address: "0x01" },
  //         type: "VaultCreated",
  //         payload: {
  //           vaultId: ENV.SYNTHETIC_VAULT_ID,
  //           collection: "ExampleNFT",
  //           tokenId: 42,
  //           shareSymbol: ENV.SYNTHETIC_SYMBOL,
  //           policy: "buyoutOnly",
  //           creator: "0x01",
  //         },
  //       } as unknown as RawEvent;
  //       await js.publish(
  //         rawSubject("Fractional", "VaultCreated"),
  //         JSON.stringify(body)
  //       );
  //       published.inc({ event: "VaultCreated" });
  //       console.log(
  //         "[ingestor] published synthetic RAW VaultCreated for smoke test"
  //       );
  //     } catch (e) {
  //       console.warn("[ingestor] failed to publish synthetic event", e);
  //     }
  //   }, 800);
  // }

  for (;;) {
    const latest = await getLatestSealedHeight();
    console.log(
      "[ingestor] latest sealed height",
      latest,
      `(cursor: ${cursor})`
    );
    if (latest <= cursor) {
      await sleep(ENV.POLL_MS);
      continue;
    }
    const to = Math.min(latest, cursor + ENV.BATCH);
    for (const eventType of ENV.EVENT_TYPES) {
      const list = await getEventsRange(eventType, cursor + 1, to);
      console.log("[ingestor] events", list.length);
      for (const ev of list) {
        console.log("[ingestor] event", ev);
        const contractName = parseContractName(eventType);
        const shortType = parseEventName(eventType);
        const out: RawEvent = {
          network: ENV.NETWORK,
          blockHeight: Number(ev.blockHeight),
          txIndex: Number(ev.transactionIndex || 0),
          evIndex: Number(ev.eventIndex || 0),
          txId: ev.transactionId,
          contract: {
            name: contractName,
            address: `0x${eventType.split(".")[1]}`,
          },
          type: shortType,
          // Publish raw Access event; normalization happens in normalizer
          payload: ev as unknown,
        };
        const subject = rawSubject(contractName, shortType);
        console.log("[ingestor] publish", subject);
        await js.publish(subject, JSON.stringify(out));
        published.inc({ event: shortType });
      }
    }
    cursor = to;
    await setCheckpoint(cursor);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseContractName(eventType: string): string {
  const parts = eventType.split(".");
  return parts[2] || "Unknown";
}

function parseEventName(eventType: string): string {
  const parts = eventType.split(".");
  return parts[3] || "Unknown";
}

// FCL helpers
async function getLatestSealedHeight(): Promise<number> {
  // Use Access REST v1: /v1/blocks?height=sealed
  try {
    const res = await fetch(`${ENV.FLOW_ACCESS}/v1/blocks?height=sealed`).then(
      (r) => r.json()
    );
    if (Array.isArray(res)) {
      const h = Number(res?.[0]?.header?.height ?? 0);
      return Number.isFinite(h) ? h : 0;
    }
    const h = Number(
      res?.block?.height ?? res?.height ?? res?.header?.height ?? 0
    );
    return Number.isFinite(h) ? h : 0;
  } catch (e) {
    console.warn(
      "[ingestor] FLOW_ACCESS unreachable when getting sealed height; retrying",
      e
    );
    return 0;
  }
}

async function getEventsRange(
  eventType: string,
  start: number,
  end: number
): Promise<AccessEventNormalized[]> {
  // Use Access REST v1: /v1/events?type=...&start_height=...&end_height=...
  const candidates: string[] = [eventType];
  // Add alternate address format (toggle 0x prefix) as fallback
  const parts = eventType.split(".");
  if (parts.length >= 4) {
    const addr = parts[1];
    const alt = addr.startsWith("0x") ? addr.slice(2) : `0x${addr}`;
    if (alt !== addr) {
      const clone = [...parts];
      clone[1] = alt;
      candidates.push(clone.join("."));
    }
  }

  for (const et of candidates) {
    try {
      const url = new URL(`${ENV.FLOW_ACCESS}/v1/events`);
      url.searchParams.set("type", et);
      url.searchParams.set("start_height", String(start));
      url.searchParams.set("end_height", String(end));
      const res = (await fetch(url.toString()).then((r) =>
        r.json()
      )) as AccessEventsResponse;
      // Flow emulator often returns a top-level array; Access REST may return { results: [...] }
      const results = Array.isArray(res)
        ? (res as unknown as AccessEventsResultItem[])
        : Array.isArray(
            (res as { results?: AccessEventsResultItem[] })?.results
          )
        ? ((res as { results?: AccessEventsResultItem[] })
            .results as AccessEventsResultItem[])
        : [];
      const events: AccessEventNormalized[] = [];
      for (const item of results) {
        const he = Number(item.block_height);
        const evs = Array.isArray(item.events) ? item.events : [];
        for (const ev of evs) {
          events.push({
            blockHeight: he,
            type: ev.type,
            transactionId: String(ev.transaction_id ?? ""),
            transactionIndex: Number(ev.transaction_index ?? 0),
            eventIndex: Number(ev.event_index ?? 0),
            payload: ev.payload,
            value: ev.value,
          });
        }
      }
      console.log("[ingestor] events", events.length, et, start, end);
      if (events.length > 0) return events;
    } catch (e) {
      console.warn("[ingestor] FLOW_ACCESS error when getting events", {
        candidateType: et,
        start,
        end,
        error: e,
      });
    }
  }
  return [];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
