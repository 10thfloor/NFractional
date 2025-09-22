"use client";

import { useEffect, useMemo, useState } from "react";
import TxActionButton from "@/app/components/TxActionButton";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import type { FclClient, FclArgFn, FclType } from "@/lib/types/fcl";
import {
  getAmmQuote,
  getAmmQuoteWithFees,
  poolInfoScript,
} from "@/lib/api/pools";
import { getVault } from "@/lib/api/vault";
import { tempAddImports } from "@/lib/cadence";
import { swapViaActionsTxAliased } from "@/lib/tx/amm";
import { Decimal, formatUFix64 } from "@/lib/num";
import { buildSwapArgs } from "@/lib/buildSwapArgs";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import { ensureVaultTreasury } from "@/lib/api/pools";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

export type PoolCardProps = {
  vaultId: string;
  poolId: string;
  owner: string;
  assetA?: string | null; // base
  assetB?: string | null; // quote
  feeBps?: number | null;
  reserveA?: string | null;
  reserveB?: string | null;
};

export default function PoolCard(props: { data: PoolCardProps }) {
  const { data } = props;
  const addrs = useFlowAddresses();
  const { user } = useFlowCurrentUser();
  const fcl = useFlowClient() as unknown as FclClient;

  const baseSymbol = String(data.assetA || "");
  const quoteSymbol = String(data.assetB || "");
  const feeBps = Number(data.feeBps || 0);
  const reserveA = Number(String(data.reserveA || "0"));
  const reserveB = Number(String(data.reserveB || "0"));
  const price = reserveA > 0 ? reserveB / reserveA : 0;
  const tvl = reserveB + (reserveA > 0 ? reserveA * price : 0);
  const status: "ACTIVE" | "PAUSED" =
    reserveA > 0 || reserveB > 0 ? "ACTIVE" : "PAUSED";

  const [fromSide, setFromSide] = useState<"BASE" | "QUOTE">("QUOTE");
  const [amount, setAmount] = useState("");
  const [slippagePct, setSlippagePct] = useState("1.0");
  const [minOut, setMinOut] = useState("0.0");
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [quoteKey, setQuoteKey] = useState<string>("");
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [feeQuote, setFeeQuote] = useState<{
    feeAmount: string;
    feeBps: number;
    vaultShare: string;
    protocolShare: string;
  } | null>(null);
  const [swapCadence, setSwapCadence] = useState<string | null>(null);
  const [effectiveOwner, setEffectiveOwner] = useState<string | null>(null);
  const custody = useVaultCustodyStatus(data.vaultId, fcl);

  // Platform treasury readiness for fee routing
  const [treasuryReady, setTreasuryReady] = useState(false);
  const [treasuryErr, setTreasuryErr] = useState<string | null>(null);

  // Live quote via API (debounced, stale-safe)
  useEffect(() => {
    let cancelled = false;
    const amt = Number((amount || "").replaceAll(",", ""));
    const direction = fromSide === "BASE" ? "share_to_flow" : "flow_to_share";
    const ownerForQuote = (effectiveOwner || data.owner) as string;
    const key = `${ownerForQuote}|${data.poolId}|${direction}|${amt}`;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!amt || amt <= 0 || !ownerForQuote) {
          if (!cancelled) {
            setQuoteOut(null);
            setFeeQuote(null);
            setMinOut("0.0");
            setQuoteKey("");
            setQuoteLoading(false);
          }
          return;
        }
        const res = await getAmmQuote({
          poolOwner: ownerForQuote,
          poolId: data.poolId,
          direction,
          amountIn: formatUFix64(new Decimal(amt)),
        });
        const resFees = await getAmmQuoteWithFees({
          poolOwner: ownerForQuote,
          poolId: data.poolId,
          direction,
          amountIn: formatUFix64(new Decimal(amt)),
          vaultId: data.vaultId,
        });
        if (cancelled) return;
        // Discard stale responses
        const currentAmt = Number((amount || "").replaceAll(",", ""));
        const currentDir =
          fromSide === "BASE" ? "share_to_flow" : "flow_to_share";
        const currentOwner = (effectiveOwner || data.owner) as string;
        const currentKey = `${currentOwner}|${data.poolId}|${currentDir}|${currentAmt}`;
        if (currentKey !== key) return;
        setQuoteOut(String(res.out));
        setFeeQuote({
          feeAmount: resFees.feeAmount,
          feeBps: resFees.feeBps,
          vaultShare: resFees.vaultShare,
          protocolShare: resFees.protocolShare,
        });
        const pct = Number(slippagePct);
        const factor = new Decimal(100).minus(pct).div(100);
        const min = new Decimal(String(res.out || "0")).mul(factor);
        setMinOut(formatUFix64(min));
        setQuoteKey(key);
      } catch {
        if (!cancelled) {
          setQuoteOut(null);
          setFeeQuote(null);
          setMinOut("0.0");
          setQuoteKey("");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    amount,
    fromSide,
    data.owner,
    effectiveOwner,
    data.poolId,
    data.vaultId,
    slippagePct,
  ]);

  // Prepare swap cadence (aliased to the per‑vault FT) once per vault
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await swapViaActionsTxAliased(data.vaultId);
        if (!cancelled) setSwapCadence(c);
      } catch {
        if (!cancelled) setSwapCadence(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.vaultId]);

  // Ensure treasuries once custody is alive and admin present
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTreasuryErr(null);
        setTreasuryReady(false);
        if (!addrs.platformAdmin) return;
        if (custody.loading || !custody.alive) return;
        await ensureVaultTreasury(data.vaultId);
        if (!cancelled) setTreasuryReady(true);
      } catch (e) {
        if (!cancelled) {
          setTreasuryReady(false);
          setTreasuryErr((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.vaultId, custody.loading, custody.alive, addrs.platformAdmin]); // Use addrs.platformAdmin directly

  // Resolve the correct pool owner by verifying the published capability.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = fcl as unknown as {
          query: (input: unknown) => Promise<unknown>;
        };
        const testOwner = (owner: string | null | undefined) =>
          owner ? (owner.startsWith("0x") ? owner : `0x${owner}`) : null;
        const ownerCandidate = testOwner(data.owner);
        const scriptBase = poolInfoScript({
          ft: null,
          flow: null,
          amm: null,
        } as never);
        const cadence = await tempAddImports(scriptBase);
        async function exists(owner: string | null): Promise<boolean> {
          if (!owner) return false;
          try {
            const res = await f.query({
              cadence,
              args: (arg: FclArgFn, t: FclType) => {
                const types = t as { Address: unknown; String: unknown };
                return [
                  arg(owner, types.Address),
                  arg(data.poolId, types.String),
                ];
              },
            });
            return !!res;
          } catch {
            return false;
          }
        }
        if (await exists(ownerCandidate)) {
          if (!cancelled) setEffectiveOwner(ownerCandidate);
          return;
        }
        // Fallback to vault creator
        const v = await getVault(data.vaultId);
        const creator = testOwner(v?.creator);
        if (await exists(creator)) {
          if (!cancelled) setEffectiveOwner(creator);
          return;
        }
        if (!cancelled) setEffectiveOwner(ownerCandidate);
      } catch {
        if (!cancelled) setEffectiveOwner(data.owner || null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fcl, data.owner, data.poolId, data.vaultId]);

  const priceLabel = useMemo(() => {
    const p = price || 0;
    return `${p.toFixed(4)} ${quoteSymbol} per ${baseSymbol}`;
  }, [price, baseSymbol, quoteSymbol]);

  const receiveAmount = useMemo(() => {
    return quoteOut ? String(quoteOut) : "";
  }, [quoteOut]);

  // Format utilities for consistent numeric affordances
  const formatCompact = (v: string | number, maxDecimals = 8): string => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0";
    const fixed = n.toFixed(maxDecimals);
    return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };

  // Execution price and price impact (always in quote per base)
  const executionPrice = useMemo(() => {
    const amtIn = Number((amount || "").replaceAll(",", ""));
    const out = Number(quoteOut || "");
    if (!amtIn || !out) return null;
    return fromSide === "QUOTE" ? amtIn / out : out / amtIn;
  }, [amount, quoteOut, fromSide]);

  const priceImpactPct = useMemo(() => {
    if (!executionPrice || !price) return null;
    const pct = ((executionPrice - price) / price) * 100;
    return pct;
  }, [executionPrice, price]);

  const platformAdmin = addrs.platformAdmin
    ? addrs.platformAdmin.startsWith("0x")
      ? addrs.platformAdmin
      : `0x${addrs.platformAdmin}`
    : null;

  const canSwap = useMemo(() => {
    const amt = Number((amount || "").replaceAll(",", ""));
    return (
      status === "ACTIVE" &&
      !!user?.addr &&
      amt > 0 &&
      !custody.loading &&
      custody.alive &&
      platformAdmin
    );
  }, [
    amount,
    status,
    user?.addr,
    custody.loading,
    custody.alive,
    platformAdmin,
  ]);

  const [walletShare, setWalletShare] = useState<string>("0.0");
  const [walletFlow, setWalletFlow] = useState<string>("0.0");
  const [vaultSymbol, setVaultSymbol] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await getVault(data.vaultId);
        if (!cancelled) setVaultSymbol(v?.shareSymbol ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.vaultId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.addr) return;
        if (!vaultSymbol) return;
        const res = (await fcl.query({
          cadence: await getWalletBalancesScriptAliased(),
          args: (arg: FclArgFn, t: FclType) => {
            const types = t as {
              Address: unknown;
              String: unknown;
              Optional: (inner: unknown) => unknown;
            };
            return [
              arg(user.addr, types.Address),
              arg(vaultSymbol, types.String),
              arg(data.poolId, types.Optional(types.String)),
            ];
          },
        })) as Record<string, string>;
        if (cancelled || !res) return;
        setWalletFlow(String(res.flow || "0.0"));
        setWalletShare(String(res.share || "0.0"));
      } catch {
        if (!cancelled) {
          setWalletFlow("0.0");
          setWalletShare("0.0");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, vaultSymbol, data.poolId, fcl]);

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-neutral-400">Pool: </div>
          {/* Constant product formula:  x * y = k  */}
          <div className="text-base font-medium text-neutral-100">
            {baseSymbol}/{quoteSymbol}
          </div>
        </div>
        <div className="text-right text-[11px] text-neutral-400">
          <div>
            TVL:{" "}
            <span className="text-neutral-100">
              {tvl.toLocaleString()} {quoteSymbol}
            </span>
          </div>
          <div>
            Fee:{" "}
            <span className="text-neutral-100">
              {(feeBps / 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {user?.addr && (
        <div className="text-[11px] text-neutral-500 flex gap-4">
          <span>
            Your FLOW:{" "}
            <span className="text-neutral-200">
              {Number(walletFlow).toFixed(6)}
            </span>
          </span>
          <span>
            Your {baseSymbol} shares:{" "}
            <span className="text-neutral-200">
              {Number(walletShare).toFixed(6)}
            </span>
          </span>
        </div>
      )}

      {status !== "ACTIVE" ? (
        <div className="rounded border border-yellow-800 bg-yellow-900/20 p-2 text-xs text-yellow-300">
          Pool is paused. Swaps are temporarily disabled.
        </div>
      ) : null}
      {treasuryErr ? (
        <div className="rounded border border-yellow-800 bg-yellow-900/20 p-2 text-xs text-yellow-300">
          Platform treasuries not ready; attempting to initialize. Please try
          again.
        </div>
      ) : null}
      {!custody.loading && !custody.alive ? (
        <div className="rounded border border-yellow-800 bg-yellow-900/20 p-2 text-xs text-yellow-300">
          Vault custody is offline. The underlying NFT was not detected in its
          LockBox. Swaps are temporarily disabled until custody is restored.
        </div>
      ) : null}

      {user && !user.loggedIn ? (
        <div className="rounded-md border border-neutral-800 p-2 bg-neutral-950">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-neutral-400">Swap</div>
          </div>
          <NotLoggedIn message="Connect your wallet to swap tokens." />
        </div>
      ) : (
        <div
          className={`rounded-md border border-neutral-800 p-2 bg-neutral-950 ${
            status !== "ACTIVE" ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-neutral-400">Swap</div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                {priceLabel}
              </div>
              {executionPrice ? (
                <div
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    Math.abs(priceImpactPct || 0) < 1
                      ? "bg-green-900/30 text-green-300"
                      : Math.abs(priceImpactPct || 0) < 5
                      ? "bg-yellow-900/30 text-yellow-300"
                      : "bg-red-900/30 text-red-300"
                  }`}
                  title={`Execution price ${formatCompact(
                    executionPrice,
                    6
                  )} ${quoteSymbol}/${baseSymbol}`}
                >
                  {priceImpactPct === null
                    ? ""
                    : `${formatCompact(Math.abs(priceImpactPct), 2)}% impact`}
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              className={`rounded border px-2 py-1 text-xs ${
                fromSide === "QUOTE"
                  ? "border-blue-500 text-blue-300"
                  : "border-neutral-700 text-neutral-300"
              }`}
              onClick={() => setFromSide("QUOTE")}
            >
              From {quoteSymbol}
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-xs ${
                fromSide === "BASE"
                  ? "border-blue-500 text-blue-300"
                  : "border-neutral-700 text-neutral-300"
              }`}
              onClick={() => setFromSide("BASE")}
            >
              From {baseSymbol}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor={`pay-${data.poolId}`}
                className="block text-xs text-neutral-400 mb-1"
              >
                You pay ({fromSide === "QUOTE" ? quoteSymbol : baseSymbol})
              </label>
              <input
                id={`pay-${data.poolId}`}
                inputMode="decimal"
                className="w-full rounded border border-neutral-800 bg-neutral-900 p-2 text-xs text-neutral-100 placeholder:text-neutral-500"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor={`recv-${data.poolId}`}
                className="block text-xs text-neutral-400 mb-1"
              >
                You receive ({fromSide === "QUOTE" ? baseSymbol : quoteSymbol})
              </label>
              <input
                id={`recv-${data.poolId}`}
                readOnly
                className="w-full rounded border border-neutral-800 bg-neutral-900 p-2 text-xs text-neutral-100 placeholder:text-neutral-500"
                placeholder="0.00"
                value={quoteLoading ? "…" : receiveAmount}
              />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-neutral-500">
                <span>Slippage</span>
                <div className="flex items-center gap-1">
                  {["0.1", "0.5", "1.0", "2.0"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`rounded border px-1.5 py-0.5 ${
                        slippagePct === p
                          ? "border-blue-500 text-blue-300"
                          : "border-neutral-700 text-neutral-300"
                      }`}
                      onClick={() => setSlippagePct(p)}
                    >
                      {p}%
                    </button>
                  ))}
                  <input
                    inputMode="decimal"
                    className="w-16 rounded border border-neutral-800 bg-neutral-900 p-1 text-[11px] text-neutral-100 placeholder:text-neutral-500"
                    value={slippagePct}
                    onChange={(e) => setSlippagePct(e.target.value)}
                    title="Custom slippage percentage"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Min out</span>
                  <input
                    readOnly
                    className="w-18 rounded border border-neutral-800 bg-neutral-900 p-1 text-[11px] text-neutral-100"
                    value={`${minOut} ${
                      fromSide === "QUOTE" ? baseSymbol : quoteSymbol
                    }`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* <Button asChild variant="outline" size="sm">
              <Link href={`/pools/${data.owner}/${data.poolId}`}>Details</Link>
            </Button> */}
              </div>
            </div>
            {feeQuote ? (
              <div className="w-full">
                <div className="text-[11px] text-neutral-400 mr-2 min-w-[210px] mb-1" />
                <div className="text-[11px] text-neutral-400 mr-2 min-w-[210px]">
                  <div className="flex items-center justify-between">
                    <span>Total fee</span>
                    <span className="text-neutral-100">
                      {formatCompact(feeQuote.feeAmount)} (
                      {(feeQuote.feeBps / 100).toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Vault</span>
                    <span className="text-neutral-100">
                      {formatCompact(feeQuote.vaultShare)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Protocol</span>
                    <span className="text-neutral-100">
                      {formatCompact(feeQuote.protocolShare)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end mt-2">
              <TxActionButton
                className="w-full"
                label="Swap"
                variant="secondary"
                size="sm"
                disabled={
                  !canSwap ||
                  !platformAdmin ||
                  !swapCadence ||
                  !effectiveOwner ||
                  !quoteOut ||
                  quoteLoading ||
                  quoteKey.length === 0 ||
                  !treasuryReady
                }
                transaction={
                  {
                    cadence: swapCadence as unknown as string,
                    args: (
                      arg: (v: unknown, type: unknown) => unknown,
                      t: {
                        Address: unknown;
                        String: unknown;
                        UFix64: unknown;
                        Bool: unknown;
                        UInt64: unknown;
                      }
                    ) =>
                      buildSwapArgs({
                        owner:
                          (effectiveOwner as string) ||
                          (data.owner?.startsWith("0x")
                            ? (data.owner as string)
                            : `0x${data.owner}`),
                        poolId: data.poolId,
                        direction:
                          fromSide === "BASE"
                            ? "share_to_flow"
                            : "flow_to_share",
                        amountIn: amount,
                        slippagePct,
                        useID: true,
                        vaultId: data.vaultId,
                        platformAdmin: platformAdmin as string,
                      })(arg, t),
                    limit: 9999,
                  } as unknown as never
                }
                mutation={{
                  mutationKey: [
                    "swap",
                    data.vaultId,
                    data.poolId,
                    fromSide,
                    amount,
                    minOut,
                  ],
                  onError: async (e: unknown) => {
                    const msg = String((e as Error).message || "");
                    if (/Provided invalid Capability/i.test(msg)) {
                      // Error handling
                      try {
                        await ensureVaultTreasury(data.vaultId);
                        setTreasuryReady(true);
                      } catch {
                        // ignore
                      }
                    }
                    console.error("Swap error", e);
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
