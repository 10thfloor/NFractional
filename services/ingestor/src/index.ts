import { connect, StringCodec } from "nats";
import client from "prom-client";
import * as fcl from "@onflow/fcl";
import fs from "node:fs";
import path from "node:path";

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

// Load event types from file or environment variable
function loadEventTypes(): string[] {
  const eventTypesFile = process.env.EVENT_TYPES_FILE;
  if (eventTypesFile) {
    try {
      const filePath = path.isAbsolute(eventTypesFile)
        ? eventTypesFile
        : path.resolve(process.cwd(), eventTypesFile);
      if (!fs.existsSync(filePath)) {
        console.warn(
          `[ingestor] EVENT_TYPES_FILE not found: ${filePath}, falling back to EVENT_TYPES env var`
        );
        return (process.env.EVENT_TYPES || "").split(",").filter(Boolean);
      }
      const content = fs.readFileSync(filePath, "utf8");
      // Parse file: one event type per line, comments start with #
      const eventTypes = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .filter(Boolean);
      console.log(
        `[ingestor] loaded ${eventTypes.length} event types from ${filePath}`
      );
      return eventTypes;
    } catch (e) {
      console.error(
        `[ingestor] failed to load EVENT_TYPES_FILE: ${eventTypesFile}`,
        e
      );
      return (process.env.EVENT_TYPES || "").split(",").filter(Boolean);
    }
  }
  // Fallback to environment variable (comma-separated)
  return (process.env.EVENT_TYPES || "").split(",").filter(Boolean);
}

const ENV = {
  NETWORK: process.env.NETWORK || "emulator",
  NATS_URL: process.env.NATS_URL || "nats://nats:4222",
  FLOW_ACCESS: process.env.FLOW_ACCESS || "http://host.docker.internal:8888",
  START_HEIGHT: Number(process.env.START_HEIGHT || 0),
  POLL_MS: Number(process.env.POLL_MS || 1500),
  BATCH: Number(process.env.BATCH || 250),
  EVENT_TYPES: loadEventTypes(),
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
  } else {
    console.log(
      `[ingestor] Loaded ${ENV.EVENT_TYPES.length} event types, starting from block ${cursor}`
    );
  }

  // Main polling loop
  for (;;) {
    const latest = await getLatestSealedHeight();
    if (latest <= cursor) {
      await sleep(ENV.POLL_MS);
      continue;
    }
    const to = Math.min(latest, cursor + ENV.BATCH);
    // Only log block range every 10 iterations to reduce log spam
    const shouldLog = Date.now() % 10000 < ENV.POLL_MS;
    if (shouldLog) {
      console.log(
        `[ingestor] Querying events from block ${
          cursor + 1
        } to ${to} (latest sealed: ${latest})`
      );
    }
    let totalEventsFound = 0;
    for (const eventType of ENV.EVENT_TYPES) {
      const list = await getEventsRange(eventType, cursor + 1, to);
      if (list.length > 0) {
        console.log(`[ingestor] Found ${list.length} events for ${eventType}`);
        totalEventsFound += list.length;
        for (const ev of list) {
          const contractName = parseContractName(eventType);
          const shortType = parseEventName(eventType);
          // Extract address from event type, handling both with and without 0x prefix
          const addrPart = eventType.split(".")[1] || "";
          const contractAddr = addrPart.startsWith("0x")
            ? addrPart
            : `0x${addrPart}`;
          const out: RawEvent = {
            network: ENV.NETWORK,
            blockHeight: Number(ev.blockHeight),
            txIndex: Number(ev.transactionIndex || 0),
            evIndex: Number(ev.eventIndex || 0),
            txId: ev.transactionId,
            contract: {
              name: contractName,
              address: contractAddr,
            },
            type: shortType,
            // Publish raw Access event; normalization happens in normalizer
            payload: ev as unknown,
          };
          const subject = rawSubject(contractName, shortType);
          await js.publish(subject, JSON.stringify(out));
          published.inc({ event: shortType });
        }
      }
    }
    if (totalEventsFound > 0) {
      console.log(
        `[ingestor] Published ${totalEventsFound} total events, advancing cursor to ${to}`
      );
    } else {
      console.log(
        `[ingestor] No events found in range ${
          cursor + 1
        }-${to}, advancing cursor`
      );
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
      const fetchUrl = url.toString();
      // Only log API requests occasionally to reduce spam
      const shouldLogRequest = Math.random() < 0.01; // Log 1% of requests
      if (shouldLogRequest) {
        console.log(
          `[ingestor] Querying Flow API: ${fetchUrl.replace(
            /start_height=\d+&end_height=\d+/,
            "start_height=...&end_height=..."
          )}`
        );
      }
      const res = (await fetch(fetchUrl).then((r) =>
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
      if (events.length > 0) {
        console.log(
          `[ingestor] Successfully fetched ${events.length} events for ${et}`
        );
        return events;
      }
    } catch (e) {
      console.warn(`[ingestor] FLOW_ACCESS error when getting events`, {
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
