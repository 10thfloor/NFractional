import { connect, StringCodec, type JetStreamClient } from "nats";
import client from "prom-client";
import * as fcl from "@onflow/fcl";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

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

// WebSocket message types
type WebSocketMessage = {
  subscription_id?: string;
  action?: string;
  topic?: string;
  payload?: {
    height?: number | string;
    id?: string;
    status?: string;
    header?: {
      height?: number | string;
      id?: string;
      [key: string]: unknown;
    };
    // Event payload structure
    block_height?: number | string;
    block_id?: string;
    block_timestamp?: string;
    events?: Array<{
      type: string;
      transaction_id?: string;
      transaction_index?: number | string;
      event_index?: number | string;
      payload?: unknown;
      value?: { fields?: CadenceField[] };
    }>;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
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
    return;
  }

  console.log(
    `[ingestor] Loaded ${ENV.EVENT_TYPES.length} event types, starting from block ${cursor}`
  );

  // Process events for a single block
  const processBlock = async (blockHeight: number): Promise<void> => {
    if (blockHeight <= cursor) {
      return; // Already processed
    }

    let totalEventsFound = 0;
    console.log(
      `[ingestor] Processing block ${blockHeight}, checking ${ENV.EVENT_TYPES.length} event types`
    );

    for (const eventType of ENV.EVENT_TYPES) {
      const list = await getEventsRange(eventType, blockHeight, blockHeight);
      if (list.length > 0) {
        console.log(
          `[ingestor] Block ${blockHeight}: Found ${list.length} event(s) for ${eventType}`
        );
        totalEventsFound += list.length;
        for (const ev of list) {
          const contractName = parseContractName(eventType);
          const shortType = parseEventName(eventType);
          // Extract address from event type, handling both A.{address}... and {address}... formats
          const parts = eventType.split(".");
          const addrPart =
            parts[0] === "A" && parts.length >= 4
              ? parts[1]
              : parts.length >= 3
              ? parts[0]
              : "";
          const contractAddr = addrPart.startsWith("0x")
            ? addrPart
            : `0x${addrPart}`;

          console.log(
            `[ingestor] ✨ Event received: ${contractName}.${shortType} at block ${blockHeight}, tx ${ev.transactionId.slice(
              0,
              8
            )}...`
          );

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
        `[ingestor] Block ${blockHeight}: Published ${totalEventsFound} total event(s), checkpoint updated to ${blockHeight}`
      );
    } else {
      console.log(
        `[ingestor] Block ${blockHeight}: No events found, checkpoint updated to ${blockHeight}`
      );
    }
    cursor = blockHeight;
    await setCheckpoint(cursor);
  };

  // Replace the catchUp function with this optimized version:
  const catchUp = async (): Promise<void> => {
    const latest = await getLatestSealedHeight();
    if (latest <= cursor) {
      console.log(
        `[ingestor] No catch-up needed (cursor: ${cursor}, latest: ${latest})`
      );
      return;
    }

    const rangeStart = cursor + 1;
    const rangeSize = latest - cursor;
    console.log(
      `[ingestor] Catching up ${rangeSize} blocks from ${rangeStart} to ${latest}`
    );

    // Query all events for the entire range in one request per event type
    const eventsByBlock = new Map<number, AccessEventNormalized[]>();
    let totalEventsFound = 0;

    console.log(
      `[ingestor] Querying ${ENV.EVENT_TYPES.length} event types for range ${rangeStart}-${latest}`
    );

    for (let i = 0; i < ENV.EVENT_TYPES.length; i++) {
      const eventType = ENV.EVENT_TYPES[i];
      console.log(
        `[ingestor] Querying event type ${i + 1}/${
          ENV.EVENT_TYPES.length
        }: ${eventType}`
      );
      // Single request for entire range instead of one per block
      const events = await getEventsRange(eventType, rangeStart, latest);

      // Group events by block height
      let eventsForThisType = 0;
      for (const ev of events) {
        const blockHeight = ev.blockHeight;
        if (!eventsByBlock.has(blockHeight)) {
          eventsByBlock.set(blockHeight, []);
        }
        eventsByBlock.get(blockHeight)?.push(ev);
        eventsForThisType++;
        totalEventsFound++;
      }
      if (eventsForThisType > 0) {
        console.log(
          `[ingestor] Found ${eventsForThisType} events for ${eventType}`
        );
      }
    }

    console.log(
      `[ingestor] Total events found: ${totalEventsFound} across ${eventsByBlock.size} blocks`
    );

    // Process blocks in order
    const sortedBlocks = Array.from(eventsByBlock.keys()).sort((a, b) => a - b);
    console.log(
      `[ingestor] Processing ${sortedBlocks.length} blocks with events`
    );

    let blocksProcessed = 0;
    for (const blockHeight of sortedBlocks) {
      const events = eventsByBlock.get(blockHeight) || [];

      // Process events for this block (same logic as processBlock)
      let eventsPublished = 0;
      for (const ev of events) {
        const eventType = ev.type; // Full event type from API response
        const contractName = parseContractName(eventType);
        const shortType = parseEventName(eventType);
        // Extract address from event type, handling both A.{address}... and {address}... formats
        const parts = eventType.split(".");
        const addrPart =
          parts[0] === "A" && parts.length >= 4
            ? parts[1]
            : parts.length >= 3
            ? parts[0]
            : "";
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
          payload: ev as unknown,
        };
        const subject = rawSubject(contractName, shortType);
        await js.publish(subject, JSON.stringify(out));
        published.inc({ event: shortType });
        eventsPublished++;
      }

      // Update checkpoint after each block
      cursor = blockHeight;
      await setCheckpoint(cursor);
      blocksProcessed++;

      if (eventsPublished > 0) {
        console.log(
          `[ingestor] Block ${blockHeight}: Published ${eventsPublished} events (${blocksProcessed}/${sortedBlocks.length} blocks processed)`
        );
      }
    }

    // Also process blocks with no events (to advance checkpoint)
    let emptyBlocksProcessed = 0;
    for (let h = cursor + 1; h <= latest; h++) {
      if (!eventsByBlock.has(h)) {
        cursor = h;
        await setCheckpoint(cursor);
        emptyBlocksProcessed++;
      }
    }

    if (emptyBlocksProcessed > 0) {
      console.log(
        `[ingestor] Advanced checkpoint through ${emptyBlocksProcessed} empty blocks`
      );
    }

    console.log(
      `[ingestor] Catch-up complete: processed ${blocksProcessed} blocks with events, ${emptyBlocksProcessed} empty blocks, checkpoint now at ${cursor}`
    );
  };

  // Catch up any missed blocks first using WebSocket (no REST API needed!)
  // We'll subscribe to events with start_block_height to catch up via WebSocket
  console.log(
    `[ingestor] Starting catch-up from block ${cursor} - will use WebSocket subscription`
  );

  // Now start WebSocket subscription for real-time updates and catch-up
  await startWebSocketIngestion(
    processBlock,
    getCheckpoint,
    setCheckpoint,
    rawSubject,
    js,
    published,
    cursor
  );
}
async function startWebSocketIngestion(
  processBlock: (height: number) => Promise<void>,
  getCheckpoint: () => Promise<number>,
  setCheckpoint: (h: number) => Promise<void>,
  rawSubject: (contract: string, ev: string) => string,
  js: JetStreamClient,
  published: client.Counter,
  startFromHeight: number
): Promise<void> {
  const wsUrl = getWebSocketUrl();
  const blockSubscriptionId = "blocks-ingest"; // Max 20 chars
  const eventSubscriptionId = "events-ingest"; // Max 20 chars
  let reconnectAttempts = 0;
  let pingInterval: NodeJS.Timeout | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  const connectWebSocket = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      console.log(`[ingestor] Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      ws.on("open", async () => {
        console.log("[ingestor] WebSocket connected");
        reconnectAttempts = 0;

        // Get current cursor for subscription start point
        const currentCursor = await getCheckpoint();
        const latestSealed = await getLatestSealedHeight();
        const startHeight =
          latestSealed > 0 ? latestSealed + 1 : currentCursor + 1;

        // Subscribe to blocks (for checkpointing blocks without events)
        try {
          const blockSubscribePayload: {
            subscription_id: string;
            action: string;
            topic: string;
            arguments?: { start_block_height?: string; block_status?: string };
          } = {
            subscription_id: blockSubscriptionId,
            action: "subscribe",
            topic: "blocks",
          };

          blockSubscribePayload.arguments = {
            start_block_height: String(startHeight),
            block_status: "sealed",
          };
          console.log(
            `[ingestor] Subscribing to blocks starting from height ${startHeight}`
          );

          ws.send(JSON.stringify(blockSubscribePayload));
          console.log("[ingestor] Subscribed to blocks topic");
        } catch (e) {
          console.error("[ingestor] Failed to subscribe to blocks", e);
          reject(e);
          return;
        }

        // Subscribe to events directly (for both catch-up and real-time - no REST API needed!)
        try {
          // Flow WebSocket API requires event types with A. prefix: A.{address}.{ContractName}.{EventName}
          // Addresses should NOT have 0x prefix in event types
          const eventSubscribePayload = {
            subscription_id: eventSubscriptionId,
            action: "subscribe",
            topic: "events",
            arguments: {
              event_types: ENV.EVENT_TYPES, // Keep A. prefix as-is
              start_block_height: String(currentCursor + 1), // Start from next block after cursor (catch-up)
            },
          };

          ws.send(JSON.stringify(eventSubscribePayload));
          console.log(
            `[ingestor] Subscribed to events topic with ${
              ENV.EVENT_TYPES.length
            } event types, starting from block ${
              currentCursor + 1
            } (catch-up + real-time)`
          );
        } catch (e) {
          console.error("[ingestor] Failed to subscribe to events", e);
          // Continue even if event subscription fails - can fall back to REST API
        }

        // Start ping interval (every 30 seconds to avoid 1-minute timeout)
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.ping();
            } catch (e) {
              console.warn("[ingestor] Ping failed", e);
            }
          }
        }, 30000);

        resolve(ws);
      });

      ws.on("error", (error: Error) => {
        console.error("[ingestor] WebSocket error", error);
        reject(error);
      });

      ws.on("close", () => {
        console.log("[ingestor] WebSocket closed");
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
      });
    });
  };

  const handleMessage = async (
    ws: WebSocket,
    message: WebSocket.Data
  ): Promise<void> => {
    try {
      const data = JSON.parse(message.toString()) as WebSocketMessage;

      // Handle errors
      if (data.error) {
        console.error(
          `[ingestor] WebSocket error: ${data.error.code} - ${data.error.message}`
        );
        return;
      }

      // Handle event messages (direct from WebSocket - no REST API needed!)
      if (
        data.subscription_id === eventSubscriptionId &&
        data.topic === "events" &&
        data.payload
      ) {
        const blockHeight = Number(data.payload.block_height);
        const events = Array.isArray(data.payload.events)
          ? data.payload.events
          : [];

        if (
          Number.isFinite(blockHeight) &&
          blockHeight > 0 &&
          events.length > 0
        ) {
          console.log(
            `[ingestor] WebSocket: Received ${events.length} event(s) for block ${blockHeight}`
          );

          // Process events directly without REST API query
          for (const ev of events) {
            const eventType = ev.type;
            const contractName = parseContractName(eventType);
            const shortType = parseEventName(eventType);

            // Extract address from event type
            const parts = eventType.split(".");
            const addrPart =
              parts[0] === "A" && parts.length >= 4
                ? parts[1]
                : parts.length >= 3
                ? parts[0]
                : "";
            const contractAddr = addrPart.startsWith("0x")
              ? addrPart
              : `0x${addrPart}`;

            console.log(
              `[ingestor] ✨ Event received: ${contractName}.${shortType} at block ${blockHeight}, tx ${
                ev.transaction_id?.slice(0, 8) || "unknown"
              }...`
            );

            const out: RawEvent = {
              network: ENV.NETWORK,
              blockHeight: blockHeight,
              txIndex: Number(ev.transaction_index || 0),
              evIndex: Number(ev.event_index || 0),
              txId: String(ev.transaction_id || ""),
              contract: {
                name: contractName,
                address: contractAddr,
              },
              type: shortType,
              payload: ev as unknown,
            };
            const subject = rawSubject(contractName, shortType);
            await js.publish(subject, JSON.stringify(out));
            published.inc({ event: shortType });
          }

          // Update checkpoint if needed
          const cursor = await getCheckpoint();
          if (blockHeight > cursor) {
            await setCheckpoint(blockHeight);
          }
        }
      }

      // Handle block messages (for catch-up and checkpointing blocks without events)
      if (
        data.subscription_id === blockSubscriptionId &&
        data.topic === "blocks" &&
        data.payload
      ) {
        // Flow WebSocket API sends block payload with header.height nested inside payload
        const height = data.payload.header?.height
          ? Number(data.payload.header.height)
          : data.payload.height
          ? Number(data.payload.height)
          : Number.NaN;

        if (Number.isFinite(height) && height > 0) {
          // Only process blocks if we haven't received events for them
          // This handles blocks with no events to advance checkpoint
          const cursor = await getCheckpoint();

          if (height > cursor) {
            console.log(
              `[ingestor] WebSocket: Received block ${height} (no events, advancing checkpoint)`
            );
            await setCheckpoint(height);
          }
        } else {
          console.warn(
            "[ingestor] WebSocket: Invalid block height in payload:",
            JSON.stringify(data.payload).slice(0, 200)
          );
        }
      }
    } catch (e) {
      console.warn("[ingestor] Failed to process WebSocket message", e);
    }
  };

  const reconnect = async (): Promise<void> => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    const backoffMs = Math.min(1000 * 2 ** reconnectAttempts, 30000);
    reconnectAttempts++;

    console.log(
      `[ingestor] WebSocket disconnected. Reconnecting in ${backoffMs}ms (attempt ${reconnectAttempts})`
    );

    reconnectTimeout = setTimeout(async () => {
      try {
        // Get current cursor and reconnect - WebSocket will catch up automatically
        const cursor = await getCheckpoint();
        console.log(
          `[ingestor] Reconnecting WebSocket, will catch up from block ${cursor}`
        );

        const ws = await connectWebSocket();
        setupWebSocket(ws);
        console.log("[ingestor] WebSocket reconnected successfully");
      } catch (e) {
        console.error("[ingestor] Reconnection failed", e);
        await reconnect();
      }
    }, backoffMs);
  };

  const setupWebSocket = (ws: WebSocket): void => {
    ws.on("message", (data: WebSocket.Data) => {
      handleMessage(ws, data).catch((e) => {
        console.error("[ingestor] Error handling message", e);
      });
    });

    ws.on("error", (error: Error) => {
      console.error("[ingestor] WebSocket error", error);
    });

    ws.on("close", () => {
      console.log("[ingestor] WebSocket closed, reconnecting...");
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      reconnect().catch((e) => {
        console.error("[ingestor] Reconnection error", e);
      });
    });

    ws.on("pong", () => {
      // Pong received, connection is alive
    });
  };

  // Initial connection
  try {
    const ws = await connectWebSocket();
    setupWebSocket(ws);
  } catch (e) {
    console.error("[ingestor] Initial WebSocket connection failed", e);
    // Fall back to polling if WebSocket fails
    console.log("[ingestor] Falling back to polling mode");
    await fallbackToPolling(processBlock, getCheckpoint);
  }
}

/**
 * Fallback to polling mode if WebSocket fails
 */
async function fallbackToPolling(
  processBlock: (height: number) => Promise<void>,
  getCheckpoint: () => Promise<number>
): Promise<void> {
  let cursor = await getCheckpoint();
  console.log("[ingestor] Starting polling fallback mode");

  for (;;) {
    const latest = await getLatestSealedHeight();
    if (latest <= cursor) {
      await sleep(ENV.POLL_MS);
      continue;
    }
    for (let h = cursor + 1; h <= latest; h++) {
      await processBlock(h);
    }
    cursor = await getCheckpoint();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Gets the WebSocket URL based on the Flow network
 */
function getWebSocketUrl(): string {
  const network = ENV.NETWORK;

  switch (network) {
    case "mainnet":
      return "wss://rest-mainnet.onflow.org/v1/ws";
    case "testnet":
      return "wss://rest-testnet.onflow.org/v1/ws";
    case "emulator":
      return "ws://localhost:8888/v1/ws";
    default:
      return "wss://rest-testnet.onflow.org/v1/ws";
  }
}

function parseContractName(eventType: string): string {
  // Handle both A.{address}.{ContractName}.{EventName} and {address}.{ContractName}.{EventName}
  const parts = eventType.split(".");
  // If starts with A., ContractName is at index 2, otherwise index 1
  return parts[0] === "A" && parts.length >= 4
    ? parts[2]
    : parts.length >= 3
    ? parts[1]
    : "Unknown";
}

function parseEventName(eventType: string): string {
  // Handle both A.{address}.{ContractName}.{EventName} and {address}.{ContractName}.{EventName}
  const parts = eventType.split(".");
  // If starts with A., EventName is at index 3, otherwise index 2
  return parts[0] === "A" && parts.length >= 4
    ? parts[3]
    : parts.length >= 3
    ? parts[2]
    : "Unknown";
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
  // Flow REST API requires event types with A. prefix: A.{address}.{ContractName}.{EventName}
  // Addresses should NOT have 0x prefix in event types
  // Keep event type as-is (with A. prefix)
  try {
    const url = new URL(`${ENV.FLOW_ACCESS}/v1/events`);
    url.searchParams.set("type", eventType);
    url.searchParams.set("start_height", String(start));
    url.searchParams.set("end_height", String(end));
    const fetchUrl = url.toString();
    console.log(
      `[ingestor] Querying Flow API: ${fetchUrl.replace(
        /start_height=\d+&end_height=\d+/,
        "start_height=...&end_height=..."
      )}`
    );
    const res = (await fetch(fetchUrl).then((r) =>
      r.json()
    )) as AccessEventsResponse;
    // Flow emulator often returns a top-level array; Access REST may return { results: [...] }
    const results = Array.isArray(res)
      ? (res as unknown as AccessEventsResultItem[])
      : Array.isArray((res as { results?: AccessEventsResultItem[] })?.results)
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
        `[ingestor] Successfully fetched ${events.length} events for ${eventType}`
      );
      return events;
    }
  } catch (e) {
    console.warn("[ingestor] FLOW_ACCESS error when getting events", {
      eventType: eventType,
      start,
      end,
      error: e,
    });
  }
  return [];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
