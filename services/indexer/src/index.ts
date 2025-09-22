import {
  connect,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  StorageType,
  RetentionPolicy,
  DiscardPolicy,
} from "nats";
import http from "node:http";
import client from "prom-client";
import { Client as Cassandra } from "cassandra-driver";
import { z } from "zod";
import {
  insertEventQuery,
  markProcessedEventQuery,
  upsertBuyoutQuery,
  upsertVaultQuery,
  setVaultStateQuery,
  setVaultMaxSupplyQuery,
  setBuyoutTalliesQuery,
  finalizeBuyoutQuery,
  upsertShareTokenQuery,
  updateShareTokenModeQuery,
  getShareTokenSupplyQuery,
  updateShareTokenSupplyQuery,
  getShareTokenVaultQuery,
  upsertListingQuery,
  upsertListingBySellerQuery,
  updateListingStatusQuery,
  getListingSellerQuery,
  updateListingBySellerStatusQuery,
  upsertPoolQuery,
  upsertPoolByAssetQuery,
  updatePoolReservesQuery,
  upsertDistributionQuery,
  upsertClaimQuery,
  getBalanceQuery,
  upsertBalanceQuery,
  insertFeeQuery,
  upsertFeeTotalsQuery,
  upsertPendingFeeScheduleQuery,
  upsertCurrentFeeScheduleQuery,
} from "./queries";

const ENV = {
  NATS_URL: process.env.NATS_URL || "nats://nats:4222",
  NETWORK: process.env.NETWORK || "emulator",
  CASSANDRA_CONTACT_POINTS: (
    process.env.CASSANDRA_CONTACT_POINTS || "scylla"
  ).split(","),
  CASSANDRA_KEYSPACE: process.env.CASSANDRA_KEYSPACE || "fractional",
  METRICS_PORT: Number(process.env.METRICS_PORT || 9101),
};

const NormEvent = z.object({
  network: z.string(),
  type: z.string(),
  vaultId: z.string().optional(),
  blockHeight: z.number(),
  txIndex: z.number(),
  evIndex: z.number(),
  txId: z.string(),
  payload: z.any(),
  ts: z.number().optional(),
});

const textDecoder = new TextDecoder();

function parseJsonLoose(bytes: Uint8Array): unknown {
  let s = textDecoder.decode(bytes);
  // Remove NUL and non-printable control chars defensively without regex ranges
  s = s.trim();
  s = Array.from(s)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(code <= 0x1f || code === 0x7f);
    })
    .join("");
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end >= start) {
      const sliced = s.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error(`Invalid JSON payload (truncated): ${s.slice(0, 200)}`);
  }
}

// Normalization (CDC decode/flatten) is handled in the normalizer.

async function main() {
  console.log("Indexer starting with env", ENV);
  // Metrics setup
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry, prefix: "app_indexer_" });

  const eventsProcessed = new client.Counter({
    name: "app_indexer_events_processed_total",
    help: "Total events processed",
    registers: [registry],
    labelNames: ["type", "network"],
  });

  const processDuration = new client.Histogram({
    name: "app_indexer_process_duration_seconds",
    help: "Time to process a message end-to-end",
    registers: [registry],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  const errorsTotal = new client.Counter({
    name: "app_indexer_errors_total",
    help: "Errors during processing",
    registers: [registry],
    labelNames: ["stage", "reason"],
  });

  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      try {
        res.setHeader("Content-Type", registry.contentType);
        res.end(await registry.metrics());
      } catch {
        res.statusCode = 500;
        res.end("metrics_error");
      }
      return;
    }
    res.statusCode = 404;
    res.end("not_found");
  });

  metricsServer.listen(ENV.METRICS_PORT, "0.0.0.0", () => {
    console.log(`metrics listening on :${ENV.METRICS_PORT}`);
  });

  const nc = await connect({ servers: ENV.NATS_URL });
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  const streamName = "FLOW_EVENTS_NORM";
  const durableName = "indexer";
  // Consume all normalized events (fractional, amm, etc.) with a single durable
  const filterSubject = `flow.events.norm.${ENV.NETWORK}.>`;

  // Ensure stream exists before creating consumers
  try {
    await jsm.streams.info(streamName);
  } catch {
    console.log(`[indexer] Creating stream ${streamName}`);
    await jsm.streams.add({
      name: streamName,
      subjects: ["flow.events.norm.*.>"],
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
      max_bytes: 536870912,
      discard: DiscardPolicy.Old,
      duplicate_window: 120000000000, // 120s in nanoseconds
      num_replicas: 1,
    });
  }

  // Ensure durable consumer exists (idempotent)
  const ensureDurableConsumer = async (): Promise<void> => {
    const apiErrCode = (e: unknown): number | undefined => {
      if (!e || typeof e !== "object") return undefined;
      const maybe = (e as { api_error?: { err_code?: number } }).api_error;
      return maybe?.err_code;
    };

    // First try info; if exists but filter_subject differs, recreate
    try {
      const info = await jsm.consumers.info(streamName, durableName);
      const currentFilter = (
        info as unknown as { config?: { filter_subject?: string } }
      )?.config?.filter_subject;
      if (currentFilter !== filterSubject) {
        try {
          await jsm.consumers.delete(streamName, durableName);
        } catch {
          // ignore delete errors; we'll attempt to add below
        }
      } else {
        // exists with correct filter
        return;
      }
    } catch (e) {
      const notFound = apiErrCode(e) === 10014; // JSConsumerNotFoundErr
      if (!notFound) {
        // transient or other error, small backoff and retry info once
        await new Promise((r) => setTimeout(r, 500));
        try {
          const info = await jsm.consumers.info(streamName, durableName);
          const currentFilter = (
            info as unknown as { config?: { filter_subject?: string } }
          )?.config?.filter_subject;
          if (currentFilter !== filterSubject) {
            try {
              await jsm.consumers.delete(streamName, durableName);
            } catch {
              /* noop */
            }
          } else {
            return;
          }
        } catch (e2) {
          if (apiErrCode(e2) !== 10014) throw e2;
        }
      }
    }

    // Create pull consumer
    try {
      await jsm.consumers.add(streamName, {
        durable_name: durableName,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        replay_policy: ReplayPolicy.Instant,
        filter_subject: filterSubject,
        max_deliver: -1,
        max_ack_pending: 10000,
      });
    } catch (e) {
      // If created in a race, proceed
      if (apiErrCode(e) !== 10013) throw e; // JSConsumerNameExistErr
    }
  };

  await ensureDurableConsumer();

  // Ensure keyspace session
  const cassandra = new Cassandra({
    contactPoints: ENV.CASSANDRA_CONTACT_POINTS,
    localDataCenter: "datacenter1",
    keyspace: ENV.CASSANDRA_KEYSPACE,
    queryOptions: { consistency: 1 },
  });

  await cassandra.connect();

  // Queries (executed with prepare=true) imported at top of module

  // Decimal math helpers with fixed scale (defaults to 8 dp)
  const SCALE = 8 as const;
  const pow10 = (n: number): bigint => {
    let x = 1n;
    for (let i = 0; i < n; i++) x *= 10n;
    return x;
  };
  const SCALE_FACTOR = pow10(SCALE);

  function parseDecimalToBigInt(
    value: string | number,
    scale: number = SCALE
  ): bigint {
    const valueStr = typeof value === "number" ? value.toString() : value;
    let s = valueStr.trim();
    if (s.length === 0) return 0n;
    const negative = s.startsWith("-");
    if (negative) s = s.slice(1);
    const [intPart, fracPartRaw = ""] = s.split(".");
    const fracPart = (fracPartRaw + "0".repeat(scale)).slice(0, scale);
    const intBig = BigInt(intPart || "0");
    const fracBig = BigInt(fracPart || "0");
    let result = intBig * pow10(scale) + fracBig;
    if (negative) result = -result;
    return result;
  }

  function formatBigIntDecimal(value: bigint, scale: number = SCALE): string {
    const negative = value < 0n;
    const abs = negative ? -value : value;
    const intPart = abs / pow10(scale);
    let fracPart = (abs % pow10(scale)).toString().padStart(scale, "0");
    // Trim trailing zeros but keep at least 1 decimal place for consistency
    fracPart = fracPart.replace(/0+$/, "");
    const result =
      fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart.toString();
    return negative ? `-${result}` : result;
  }

  function addDecimalStrings(a: string | number, b: string | number): string {
    const ai = parseDecimalToBigInt(a);
    const bi = parseDecimalToBigInt(b);
    return formatBigIntDecimal(ai + bi);
  }

  function subDecimalStrings(a: string | number, b: string | number): string {
    const ai = parseDecimalToBigInt(a);
    const bi = parseDecimalToBigInt(b);
    return formatBigIntDecimal(ai - bi);
  }

  // Bind to durable consumer
  const consumer = await js.consumers.get(streamName, durableName);
  const messages = await consumer.consume({});

  (async () => {
    for await (const m of messages) {
      const endTimer = processDuration.startTimer();
      try {
        const data = parseJsonLoose(m.data);
        console.log("Raw message data:", JSON.stringify(data, null, 2));
        const ev = NormEvent.parse(data);
        console.log("Parsed event:", JSON.stringify(ev, null, 2));

        // Idempotency: attempt to mark event as processed. If it already exists, skip further work.
        try {
          const res = await cassandra.execute(
            markProcessedEventQuery,
            [ev.network, ev.txId, ev.evIndex],
            { prepare: true }
          );
          const applied = res.wasApplied();
          if (!applied) {
            // Already processed; ack and continue
            m.ack();
            eventsProcessed.inc({ type: ev.type, network: ev.network });
            endTimer();
            continue;
          }
        } catch (e) {
          // If marking fails (transient), do not skip processing to avoid data loss; proceed
          console.warn("idempotency mark failed; proceeding", e);
        }
        // Resolve vaultId for symbol-based events when missing
        const symbolFromPayload =
          (ev?.payload && typeof ev.payload === "object"
            ? (ev.payload as { symbol?: unknown }).symbol
            : undefined) || undefined;
        let resolvedVaultId: string | undefined = ev.vaultId;
        if (!resolvedVaultId && typeof symbolFromPayload === "string") {
          try {
            const r = await cassandra.execute(
              getShareTokenVaultQuery,
              [ev.network, symbolFromPayload],
              { prepare: true }
            );
            const row = r.first();
            if (row) {
              const vid = row.get("vault_id") as string | undefined;
              if (vid) resolvedVaultId = vid;
            }
          } catch {
            // best-effort; proceed without vault id if lookup fails
          }
        }
        console.log(
          `event ${ev.type} network=${ev.network} vault=${
            resolvedVaultId || ev.vaultId || "-"
          } bh=${ev.blockHeight} txi=${ev.txIndex} evi=${ev.evIndex} tx=${
            ev.txId
          }`
        );

        // write generic event row
        await cassandra.execute(
          insertEventQuery,
          [
            ev.network,
            resolvedVaultId || ev.vaultId || "-",
            ev.blockHeight,
            ev.txIndex,
            ev.evIndex,
            ev.txId,
            ev.type,
            JSON.stringify(ev.payload),
          ],
          { prepare: true }
        );

        // project by type
        switch (ev.type) {
          case "FeeAccrued": {
            const p = ev.payload as {
              vaultId: string;
              kind: string;
              token: string;
              amount: string | number;
              vaultShare: string | number;
              protocolShare: string | number;
              payer: string;
            };
            await cassandra.execute(
              insertFeeQuery,
              [
                ev.network,
                p.vaultId,
                p.kind,
                p.token,
                String(p.amount),
                String(p.vaultShare),
                String(p.protocolShare),
                p.payer,
                ev.txId,
              ],
              { prepare: true }
            );
            // Update fee_totals
            try {
              const sel = await cassandra.execute(
                "SELECT amount_total, vault_total, protocol_total FROM fractional.fee_totals WHERE network=? AND token=?",
                [ev.network, p.token],
                { prepare: true }
              );
              const row = sel.first();
              const curAmt = BigInt(
                (row?.get("amount_total") as string | null) || "0"
              );
              const curVlt = BigInt(
                (row?.get("vault_total") as string | null) || "0"
              );
              const curPrt = BigInt(
                (row?.get("protocol_total") as string | null) || "0"
              );
              const toScaled = (v: string | number): bigint => {
                const s = typeof v === "number" ? v.toString() : v;
                const [i, f = ""] = s.split(".");
                const ii = BigInt(i || "0");
                const ff = BigInt(`${f}00000000`.slice(0, 8));
                return ii * 100000000n + ff;
              };
              const newAmt = curAmt + toScaled(p.amount);
              const newVlt = curVlt + toScaled(p.vaultShare);
              const newPrt = curPrt + toScaled(p.protocolShare);
              await cassandra.execute(
                upsertFeeTotalsQuery,
                [
                  String(newAmt),
                  String(newVlt),
                  String(newPrt),
                  ev.network,
                  p.token,
                ],
                { prepare: true }
              );
            } catch (e) {
              console.warn("fee_totals upsert failed", e);
            }
            break;
          }
          case "FeeParamsProposed": {
            const p = ev.payload as {
              vaultId: string;
              feeBps: string | number;
              vaultSplitBps: string | number;
              protocolSplitBps: string | number;
              effectiveAt: string | number;
            };
            await cassandra.execute(
              upsertPendingFeeScheduleQuery,
              [
                String(p.feeBps),
                String(p.vaultSplitBps),
                String(p.protocolSplitBps),
                String(p.effectiveAt),
                ev.network,
                p.vaultId,
              ],
              { prepare: true }
            );
            break;
          }
          case "FeeParamsActivated":
          case "FeeParamsSet": {
            const p = ev.payload as {
              vaultId: string;
              feeBps: string | number;
              vaultSplitBps: string | number;
              protocolSplitBps: string | number;
            };
            await cassandra.execute(
              upsertCurrentFeeScheduleQuery,
              [
                String(p.feeBps),
                String(p.vaultSplitBps),
                String(p.protocolSplitBps),
                ev.network,
                p.vaultId,
              ],
              { prepare: true }
            );
            break;
          }
          case "MaxSupplySet": {
            const p = ev.payload as { vaultId: string; maxSupply: string };
            await cassandra.execute(
              setVaultMaxSupplyQuery,
              [String(p.maxSupply), ev.network, p.vaultId],
              { prepare: true }
            );
            break;
          }
          case "UnderlyingBurned": {
            const p = ev.payload as { vaultId: string };
            await cassandra.execute(
              setVaultStateQuery,
              ["invalid", ev.network, p.vaultId],
              { prepare: true }
            );
            break;
          }
          case "UnderlyingWithdrawn":
          case "UnderlyingDeposited": {
            // Events are stored in fractional.events already; no projection change required
            break;
          }
          case "VaultCreated": {
            // Expect normalized payload (flat KV) from normalizer
            const p = ev.payload as Record<string, unknown>;
            const vaultId = String(p.vaultId ?? p.vault_id ?? "");
            const collection = String(p.collection ?? "");
            const tokenId = String(p.tokenId ?? p.token_id ?? "");
            const shareSymbol = String(p.shareSymbol ?? p.share_symbol ?? "");
            const policy = String(p.policy ?? "");
            const creator = String(p.creator ?? "");

            console.log("Processing VaultCreated event for vault:", vaultId);

            await cassandra.execute(
              upsertVaultQuery,
              [
                ev.network,
                vaultId,
                collection,
                tokenId,
                shareSymbol,
                policy,
                creator,
                "open",
              ],
              { prepare: true }
            );
            // Also register share token with defaults (decimals 8, mode open)
            await cassandra.execute(
              upsertShareTokenQuery,
              [ev.network, shareSymbol, vaultId, 8, "0.0", "open", creator],
              { prepare: true }
            );
            break;
          }
          case "SharesMinted": {
            // Payload supports either a single mint {symbol, account, amount}
            // or batch {symbol, mints:[{account, amount},...]}
            type MintSingle = {
              symbol?: string;
              account: string;
              amount: string | number;
            };
            type MintBatch = {
              symbol?: string;
              mints: Array<{ account: string; amount: string | number }>;
            };
            const p = ev.payload as MintSingle | MintBatch;
            const symbol = (p as { symbol?: string }).symbol;
            if (!symbol) {
              // Without symbol we cannot attribute balances; keep only event row
              break;
            }
            const updates: Array<{ account: string; delta: string }> = [];
            if ("mints" in p && Array.isArray(p.mints)) {
              for (const m of p.mints) {
                if (!m?.account || m.amount === undefined) continue;
                updates.push({
                  account: m.account,
                  delta: addDecimalStrings(0, m.amount),
                });
              }
            } else if ("account" in p) {
              updates.push({
                account: p.account,
                delta: addDecimalStrings(0, p.amount),
              });
            }
            // Apply balance increments and compute total minted
            let totalDelta = "0";
            for (const u of updates) {
              const cur = await cassandra.execute(
                getBalanceQuery,
                [ev.network, symbol, u.account],
                { prepare: true }
              );
              const currentAmount = cur.first()?.get("amount") as
                | string
                | undefined;
              const newAmount = currentAmount
                ? addDecimalStrings(currentAmount, u.delta)
                : addDecimalStrings(0, u.delta);
              await cassandra.execute(
                upsertBalanceQuery,
                [ev.network, symbol, u.account, newAmount],
                { prepare: true }
              );
              totalDelta = addDecimalStrings(totalDelta, u.delta);
            }
            // Update total supply
            const supRow = await cassandra.execute(
              getShareTokenSupplyQuery,
              [ev.network, symbol],
              { prepare: true }
            );
            const sup = supRow.first()?.get("total_supply") as
              | string
              | undefined;
            const newSupply = sup
              ? addDecimalStrings(sup, totalDelta)
              : addDecimalStrings(0, totalDelta);
            await cassandra.execute(
              updateShareTokenSupplyQuery,
              [newSupply, ev.network, symbol],
              { prepare: true }
            );
            break;
          }
          case "Transfer": {
            // Standard token transfer
            const p = ev.payload as {
              symbol?: string;
              from: string;
              to: string;
              amount: string | number;
            };
            const symbol = p.symbol;
            if (!symbol) break;
            if (!p.from || !p.to) break;
            if (p.from === p.to) break;
            const amt = addDecimalStrings(0, p.amount);
            // From balance
            const fromRow = await cassandra.execute(
              getBalanceQuery,
              [ev.network, symbol, p.from],
              { prepare: true }
            );
            const fromCur = fromRow.first()?.get("amount") as
              | string
              | undefined;
            const fromNew = fromCur
              ? subDecimalStrings(fromCur, amt)
              : subDecimalStrings(0, amt);
            await cassandra.execute(
              upsertBalanceQuery,
              [ev.network, symbol, p.from, fromNew],
              { prepare: true }
            );
            // To balance
            const toRow = await cassandra.execute(
              getBalanceQuery,
              [ev.network, symbol, p.to],
              { prepare: true }
            );
            const toCur = toRow.first()?.get("amount") as string | undefined;
            const toNew = toCur
              ? addDecimalStrings(toCur, amt)
              : addDecimalStrings(0, amt);
            await cassandra.execute(
              upsertBalanceQuery,
              [ev.network, symbol, p.to, toNew],
              { prepare: true }
            );
            // Total supply unchanged on transfer
            break;
          }
          case "Redeemed": {
            const p = ev.payload as { vaultId: string };
            await cassandra.execute(
              setVaultStateQuery,
              ["redeemed", ev.network, p.vaultId],
              { prepare: true }
            );
            break;
          }
          case "TransferModeChanged": {
            const p = ev.payload as { symbol: string; mode: string };
            await cassandra.execute(
              updateShareTokenModeQuery,
              [p.mode, ev.network, p.symbol],
              { prepare: true }
            );
            break;
          }
          case "BuyoutProposed": {
            const p = ev.payload as {
              vaultId: string;
              proposalId: string;
              proposer: string;
              asset: string;
              amount: number | string;
              quorumPercent: number;
              supportPercent: number;
              expiresAt?: number | string | Date;
            };
            await cassandra.execute(
              upsertBuyoutQuery,
              [
                ev.network,
                p.vaultId,
                p.proposalId,
                p.proposer,
                p.asset,
                String(p.amount),
                p.quorumPercent,
                p.supportPercent,
                new Date(p.expiresAt || Date.now()),
                "open",
                "0.0",
                "0.0",
                null,
              ],
              { prepare: true }
            );
            break;
          }
          case "BuyoutVoted": {
            const p = ev.payload as {
              vaultId: string;
              proposalId: string;
              forVotes: string;
              againstVotes: string;
            };
            await cassandra.execute(
              setBuyoutTalliesQuery,
              [p.forVotes, p.againstVotes, ev.network, p.vaultId, p.proposalId],
              { prepare: true }
            );
            break;
          }
          case "BuyoutFinalized": {
            const p = ev.payload as {
              vaultId: string;
              proposalId: string;
              result: string;
            };
            await cassandra.execute(
              finalizeBuyoutQuery,
              [p.result, ev.network, p.vaultId, p.proposalId],
              { prepare: true }
            );
            if (p.result === "succeeded") {
              await cassandra.execute(
                setVaultStateQuery,
                ["redeemed", ev.network, p.vaultId],
                { prepare: true }
              );
            }
            break;
          }
          case "DistributionScheduled": {
            const p = ev.payload as {
              vaultId: string;
              programId: string;
              asset: string;
              totalAmount: string;
              schedule: unknown;
              startsAt?: number | string | Date;
              endsAt?: number | string | Date;
            };
            await cassandra.execute(
              upsertDistributionQuery,
              [
                ev.network,
                p.vaultId,
                p.programId,
                p.asset,
                p.totalAmount,
                JSON.stringify(p.schedule),
                p.startsAt ? new Date(p.startsAt) : null,
                p.endsAt ? new Date(p.endsAt) : null,
              ],
              { prepare: true }
            );
            break;
          }
          case "PayoutClaimed": {
            const p = ev.payload as {
              programId: string;
              account: string;
              amount: string;
            };
            await cassandra.execute(
              upsertClaimQuery,
              [ev.network, p.programId, p.account, p.amount],
              { prepare: true }
            );
            break;
          }
          case "ListingCreated": {
            const p = ev.payload as {
              vaultId: string;
              listingId: string;
              seller: string;
              priceAsset: string;
              priceAmount: string;
              amount: string;
            };
            await cassandra.execute(
              upsertListingQuery,
              [
                ev.network,
                p.vaultId,
                p.listingId,
                p.seller,
                p.priceAsset,
                p.priceAmount,
                p.amount,
                "open",
              ],
              { prepare: true }
            );
            await cassandra.execute(
              upsertListingBySellerQuery,
              [
                ev.network,
                p.seller,
                p.listingId,
                p.vaultId,
                p.priceAsset,
                p.priceAmount,
                p.amount,
                "open",
              ],
              { prepare: true }
            );
            break;
          }
          case "ListingFilled": {
            const p = ev.payload as { vaultId: string; listingId: string };
            await cassandra.execute(
              updateListingStatusQuery,
              ["filled", ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            // Also update seller view
            const sellerRow = await cassandra.execute(
              getListingSellerQuery,
              [ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            const seller = sellerRow.rows[0]?.get("seller") as
              | string
              | undefined;
            if (seller) {
              await cassandra.execute(
                updateListingBySellerStatusQuery,
                ["filled", ev.network, seller, p.listingId],
                { prepare: true }
              );
            }
            break;
          }
          case "ListingCancelled": {
            const p = ev.payload as { vaultId: string; listingId: string };
            await cassandra.execute(
              updateListingStatusQuery,
              ["cancelled", ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            const sellerRow = await cassandra.execute(
              getListingSellerQuery,
              [ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            const seller = sellerRow.rows[0]?.get("seller") as
              | string
              | undefined;
            if (seller) {
              await cassandra.execute(
                updateListingBySellerStatusQuery,
                ["cancelled", ev.network, seller, p.listingId],
                { prepare: true }
              );
            }
            break;
          }
          case "ListingExpired": {
            const p = ev.payload as { vaultId: string; listingId: string };
            await cassandra.execute(
              updateListingStatusQuery,
              ["expired", ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            const sellerRow = await cassandra.execute(
              getListingSellerQuery,
              [ev.network, p.vaultId, p.listingId],
              { prepare: true }
            );
            const seller = sellerRow.rows[0]?.get("seller") as
              | string
              | undefined;
            if (seller) {
              await cassandra.execute(
                updateListingBySellerStatusQuery,
                ["expired", ev.network, seller, p.listingId],
                { prepare: true }
              );
            }
            break;
          }
          case "PoolCreated": {
            const p = ev.payload as {
              vaultId: string;
              poolId: string;
              assetA: string;
              assetB: string;
              reserveA: string;
              reserveB: string;
              feeBps: number;
            };
            const owner: string = ((ev.payload as any)?.owner as string) || "";
            await cassandra.execute(
              upsertPoolQuery,
              [
                ev.network,
                p.vaultId,
                p.poolId,
                owner,
                p.assetA,
                p.assetB,
                p.reserveA,
                p.reserveB,
                p.feeBps,
              ],
              { prepare: true }
            );
            await cassandra.execute(
              upsertPoolByAssetQuery,
              [
                ev.network,
                p.assetA,
                p.poolId,
                p.vaultId,
                owner,
                p.assetB,
                p.reserveA,
                p.reserveB,
                p.feeBps,
              ],
              { prepare: true }
            );
            await cassandra.execute(
              upsertPoolByAssetQuery,
              [
                ev.network,
                p.assetB,
                p.poolId,
                p.vaultId,
                owner,
                p.assetA,
                p.reserveB,
                p.reserveA,
                p.feeBps,
              ],
              { prepare: true }
            );
            break;
          }
          case "LiquidityAdded":
          case "LiquidityRemoved":
          case "Swap": {
            const p = ev.payload as {
              vaultId: string;
              poolId: string;
              reserveA?: string;
              reserveB?: string;
            };
            if (p.reserveA && p.reserveB) {
              await cassandra.execute(
                updatePoolReservesQuery,
                [p.reserveA, p.reserveB, ev.network, p.vaultId, p.poolId],
                { prepare: true }
              );
            } else {
              // TODO: derive reserves delta from payload if available
            }
            break;
          }
          default: {
            // Unknown or unhandled event; keep in events table only
            break;
          }
        }

        m.ack();
        eventsProcessed.inc({ type: ev.type, network: ev.network });
        endTimer();
      } catch (err) {
        console.error("indexer message error", err);
        // Ack to avoid infinite redelivery on malformed payloads
        try {
          m.ack();
        } catch {
          /* noop */
        }
        const reason = (err as Error)?.name || "error";
        errorsTotal.inc({ stage: "process", reason });
      }
    }
  })();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
