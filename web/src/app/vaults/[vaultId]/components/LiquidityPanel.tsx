"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import NumericInput from "@/components/form/NumericInput";
import { Button } from "@/components/ui/button";
import TxActionButton from "@/app/components/TxActionButton";
import {
  removeLiquidityTxAliased,
  addLiquidityWithChangeTxAliased,
  addLiquidityTxAliased,
  zapAddLiquidityTxAliased,
} from "@/lib/tx/amm";
import { ensureUFix64String } from "@/lib/cadence";
import { Decimal, formatUFix64 } from "@/lib/num";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { getVault } from "@/lib/api/vault";
import { poolInfoScript } from "@/lib/api/pools";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";
import { waitForTransactionSealed } from "@/lib/tx/utils";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import { tempAddImports } from "@/lib/cadence";
import { getVaultMaxSupply, getVaultTotalSupply } from "@/lib/api/vault";
import MintSharesCard from "./MintSharesCard";
import NotLoggedIn from "@/components/ui/NotLoggedIn";
import type { FclClient, FclArgFn, FclType } from "@/lib/types/fcl";
import { useTransactionStatusModal } from "@/app/TransactionStatusContext";
import { useTreasuryReady } from "@/hooks/useTreasuryReady";

export default function LiquidityPanel({
  vaultId,
  poolId,
  poolReserves,
  onReservesUpdated,
}: {
  vaultId: string;
  poolId: string;
  poolReserves: { share: number; flow: number };
  onReservesUpdated?: (r: { share: number; flow: number }) => void;
}) {
  const [poolCapPath, setPoolCapPath] = useState<string | null>(null);
  const [creator, setCreator] = useState<string | null>(null);

  const fcl = useFlowClient() as unknown as FclClient;
  const { user } = useFlowCurrentUser();
  const addrs = useFlowAddresses();
  const { showTransaction } = useTransactionStatusModal();

  const userAuth = useMemo(() => fcl.currentUser().authorization, [fcl]);
  const [shareIn, setShareIn] = useState<string>("");
  const [flowIn, setFlowIn] = useState<string>("");
  const [minLpOut, setMinLpOut] = useState<string>("0.0");
  const [lpAmount, setLpAmount] = useState<string>("");
  const [minShare, setMinShare] = useState<string>("0.0");
  const [minFlow, setMinFlow] = useState<string>("0.0");
  const [vaultSymbol, setVaultSymbol] = useState<string | null>(null);
  const [walletShare, setWalletShare] = useState<string>("0.0");
  const [walletFlow, setWalletFlow] = useState<string>("0.0");
  const [walletLP, setWalletLP] = useState<string>("0.0");
  const [maxSupply, setMaxSupply] = useState<string | null>(null);
  const [currentSupply, setCurrentSupply] = useState<string | null>(null);
  const [zapFlowIn, setZapFlowIn] = useState<string>("");
  const [zapMinLpOut, setZapMinLpOut] = useState<string>("0.0");
  const [zapCadence, setZapCadence] = useState<string | null>(null);
  const custody = useVaultCustodyStatus(vaultId, fcl);
  const { ready: treasuryReady, setReady: setTreasuryReady } =
    useTreasuryReady(vaultId);

  // Local reserves override after successful tx (live refresh)
  const [reservesOverride, setReservesOverride] = useState<{
    share: number;
    flow: number;
  } | null>(null);

  // Use refreshed reserves if present, else props
  const effectiveReserves = reservesOverride ?? poolReserves;
  const reserveShare = Number.isFinite(effectiveReserves.share)
    ? effectiveReserves.share
    : 0;
  const reserveFlow = Number.isFinite(effectiveReserves.flow)
    ? effectiveReserves.flow
    : 0;
  const isEmpty = reserveShare === 0 && reserveFlow === 0;

  async function refreshReserves() {
    try {
      if (!creator) return;
      const script = await tempAddImports(
        poolInfoScript(addrs as unknown as Parameters<typeof poolInfoScript>[0])
      );
      const res = (await fcl.query({
        cadence: script,
        args: (arg: FclArgFn, t: FclType) => [
          arg(creator, (t as { Address: unknown }).Address),
          arg(poolId, (t as { String: unknown }).String),
        ],
      })) as { [k: string]: string } | null;
      const next = {
        share: Number(res?.share || 0),
        flow: Number(res?.flow || 0),
      };
      setReservesOverride(next);
      try {
        onReservesUpdated?.(next);
      } catch {}
    } catch {
      // ignore transient errors; UI will rely on next page refresh
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cZap = await zapAddLiquidityTxAliased(vaultId);
        if (!cancelled) setZapCadence(cZap);
      } catch {
        if (!cancelled) setZapCadence(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Set up pool cap path for this specific pool
        if (!cancelled) {
          setPoolCapPath(`/public/AMM_Pool_${poolId}`);
        }
        const v = await getVault(vaultId);
        if (!cancelled && v?.creator) setCreator(v.creator);
        if (!cancelled) setVaultSymbol(v?.shareSymbol ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId, poolId]);

  // Load wallet balances (FLOW, share, LP) similar to Swap panel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.addr) return;
        if (!vaultSymbol) return;
        // Use the passed poolId directly
        const res = (await fcl.query({
          cadence: await getWalletBalancesScriptAliased(),
          args: (arg: FclArgFn, t: FclType) => [
            arg(user.addr, (t as { Address: unknown }).Address),
            arg(vaultSymbol, (t as { String: unknown }).String),
            arg(
              poolId,
              (t as { Optional: (inner: unknown) => unknown }).Optional(
                (t as { String: unknown }).String
              )
            ),
          ],
        })) as Record<string, string>;
        if (cancelled || !res) return;
        setWalletFlow(String(res.flow || "0.0"));
        setWalletShare(String(res.share || "0.0"));
        setWalletLP(String(res.lp || "0.0"));
      } catch {
        if (!cancelled) {
          setWalletFlow("0.0");
          setWalletShare("0.0");
          setWalletLP("0.0");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, vaultSymbol, poolId, fcl]);

  // Fetch max supply and current supply for minting card
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [max, current] = await Promise.all([
          getVaultMaxSupply(vaultId),
          getVaultTotalSupply(vaultId),
        ]);
        if (!cancelled) {
          setMaxSupply(max);
          setCurrentSupply(current);
        }
      } catch {
        if (!cancelled) {
          setMaxSupply(null);
          setCurrentSupply(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  const [addSimpleCadence, setAddSimpleCadence] = useState<string | null>(null);
  const [removeCadence, setRemoveCadence] = useState<string | null>(null);

  const suggestedFlowForShare = useMemo(() => {
    const xs = Number(shareIn);
    if (!(reserveShare > 0 && reserveFlow > 0 && xs > 0)) return null;
    return xs * (reserveFlow / reserveShare);
  }, [reserveShare, reserveFlow, shareIn]);

  const suggestedShareForFlow = useMemo(() => {
    const yf = Number(flowIn);
    if (!(reserveShare > 0 && reserveFlow > 0 && yf > 0)) return null;
    return yf * (reserveShare / reserveFlow);
  }, [reserveShare, reserveFlow, flowIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cSimple, cRemove] = await Promise.all([
          addLiquidityWithChangeTxAliased(vaultId),
          removeLiquidityTxAliased(vaultId),
        ]);
        if (!cancelled) {
          setAddSimpleCadence(cSimple);
          setRemoveCadence(cRemove);
        }
      } catch {
        if (!cancelled) {
          setAddSimpleCadence(null);
          setRemoveCadence(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  // Seed state (only shown when pool is empty and user is the creator)
  const [seedShareAmount, setSeedShareAmount] = useState<string>("");
  const [seedFlowAmount, setSeedFlowAmount] = useState<string>("");
  const [seedMinLpOut, setSeedMinLpOut] = useState<string>("0.00000001");
  const [seedSubmitting, setSeedSubmitting] = useState<boolean>(false);
  const [seedErr, setSeedErr] = useState<string | null>(null);

  const canSeed = useMemo(() => {
    if (!creator || !user?.addr) return false;
    return creator.toLowerCase() === user.addr.toLowerCase();
  }, [creator, user?.addr]);

  // Detect if user needs to mint shares before seeding
  const needsMinting = useMemo(() => {
    const userBalanceNum = Number.parseFloat(walletShare || "0");
    return isEmpty && canSeed && userBalanceNum === 0;
  }, [isEmpty, canSeed, walletShare]);

  // Refresh balances after successful mint
  const refreshBalances = useCallback(async () => {
    if (!user?.addr || !vaultSymbol) return;
    try {
      const res = (await fcl.query({
        cadence: await getWalletBalancesScriptAliased(),
        args: (arg: FclArgFn, t: FclType) => [
          arg(user.addr, (t as { Address: unknown }).Address),
          arg(vaultSymbol, (t as { String: unknown }).String),
          arg(
            poolId,
            (t as { Optional: (inner: unknown) => unknown }).Optional(
              (t as { String: unknown }).String
            )
          ),
        ],
      })) as Record<string, string>;
      if (res) {
        setWalletFlow(String(res.flow || "0.0"));
        setWalletShare(String(res.share || "0.0"));
        setWalletLP(String(res.lp || "0.0"));
      }
    } catch {
      // ignore errors
    }
  }, [user?.addr, vaultSymbol, poolId, fcl]);

  async function onSeed() {
    if (!poolCapPath) return;
    setSeedErr(null);
    setSeedSubmitting(true);
    try {
      const identifier = String(poolCapPath).replace(/^\/public\//, "");
      const txId = await fcl.mutate({
        cadence: await addLiquidityTxAliased(vaultId),
        args: (arg: FclArgFn, t: FclType) => {
          const types = t as {
            Address: unknown;
            String: unknown;
            UFix64: unknown;
          };
          return [
            arg(creator, types.Address),
            arg(identifier, types.String),
            arg(formatUFix64(new Decimal(seedShareAmount || 0)), types.UFix64),
            arg(formatUFix64(new Decimal(seedFlowAmount || 0)), types.UFix64),
            arg(formatUFix64(new Decimal(seedMinLpOut || 0)), types.UFix64),
            arg(vaultId, types.String),
          ];
        },
        limit: 9999,
      });

      // Show in modal and track sealing
      showTransaction(txId as string);
      // Wait for transaction to be sealed via websocket
      await waitForTransactionSealed(fcl, txId);

      // Clear inputs locally; parent will refresh reserves on next query tick
      setSeedShareAmount("");
      setSeedFlowAmount("");
      refreshBalances();
    } catch (e) {
      setSeedErr((e as Error).message);
    } finally {
      setSeedSubmitting(false);
    }
  }

  if (user && !user.loggedIn) {
    return (
      <div className="space-y-3">
        <h3 id="manage-liquidity" className="font-medium">
          Manage Liquidity
        </h3>
        <NotLoggedIn message="Connect your wallet to manage liquidity." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 id="manage-liquidity" className="font-medium">
        Manage Liquidity
      </h3>
      {user?.addr && (
        <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-[11px] text-neutral-400 flex gap-4">
          <span>
            Your FLOW:{" "}
            <span className="text-neutral-100 font-medium">
              {Number(walletFlow).toFixed(6)}
            </span>
          </span>
          <span>
            Your {vaultSymbol ?? "share"} shares:{" "}
            <span className="text-neutral-100 font-medium">
              {Number(walletShare).toFixed(6)}
            </span>
          </span>
          <span>
            Your LP:{" "}
            <span className="text-neutral-100 font-medium">
              {Number(walletLP).toFixed(6)}
            </span>
          </span>
        </div>
      )}
      {needsMinting && (
        <MintSharesCard
          vaultId={vaultId}
          vaultSymbol={vaultSymbol ?? "share"}
          maxSupply={maxSupply}
          currentSupply={currentSupply}
          onSuccess={refreshBalances}
        />
      )}
      {isEmpty && canSeed && !needsMinting && (
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
            <div className="font-medium mb-1 text-blue-400">
              Seed the pool first
            </div>
            <div className="text-neutral-400">
              Seed using your wallet&apos;s shares and FLOW. This action is only
              available before the pool has any reserves.
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-200">
              Seed liquidity
            </div>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <NumericInput
                placeholder="Share amount"
                value={seedShareAmount}
                onValueChange={setSeedShareAmount}
                className="w-32"
                decimals={8}
              />
              <NumericInput
                placeholder="FLOW amount"
                value={seedFlowAmount}
                onValueChange={setSeedFlowAmount}
                className="w-32"
                decimals={8}
              />
              <NumericInput
                placeholder="Min LP"
                value={seedMinLpOut}
                onValueChange={setSeedMinLpOut}
                className="w-28"
                decimals={8}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onSeed()}
                disabled={seedSubmitting || !seedShareAmount || !seedFlowAmount}
              >
                {seedSubmitting ? "Seeding…" : "Seed"}
              </Button>
              {seedErr ? <span className="text-red-500">{seedErr}</span> : null}
            </div>
          </div>
        </div>
      )}
      <div
        className={`rounded-md border border-emerald-800/40 bg-emerald-950/20 p-3 space-y-2 ${
          isEmpty ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-neutral-100">
            Zap In (FLOW → LP)
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-700 text-emerald-300">
            Recommended
          </span>
        </div>
        {isEmpty && (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
            This pool is empty. Seed the pool first to set the initial price.
          </div>
        )}
        {!isEmpty && (
          <div className="text-[11px] text-neutral-400">
            Provide only FLOW. We&apos;ll swap the optimal portion to shares and
            add liquidity. Any dust is refunded.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <div className="min-w-[10rem]">
            <div className="text-[11px] text-gray-500 mb-1">
              FLOW amount (zap)
            </div>
            <NumericInput
              id="zap-flow"
              placeholder="e.g. 1.0"
              value={zapFlowIn}
              onValueChange={setZapFlowIn}
              decimals={8}
            />
          </div>
          <div className="min-w-[10rem]">
            <div className="text-[11px] text-gray-500 mb-1">
              Min LP (slippage)
            </div>
            <NumericInput
              id="zap-minlp"
              placeholder="e.g. 0.00000000"
              value={zapMinLpOut}
              onValueChange={setZapMinLpOut}
              decimals={8}
            />
            <div className="text-[11px] text-gray-500 mt-1">
              If minted LP is below this, the transaction reverts.
            </div>
          </div>
          <div className="mt-6">
            <TxActionButton
              label="Zap In (FLOW → LP)"
              variant="secondary"
              disabled={
                !(
                  zapCadence &&
                  creator &&
                  poolCapPath &&
                  Number(zapFlowIn) > 0
                ) ||
                custody.loading ||
                !custody.alive
              }
              beforeExecute={async () => {
                if (treasuryReady) return;
                const API =
                  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
                await fetch(`${API}/pools/ensure-ready`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ vaultId }),
                }).then(async (r) => {
                  if (!r.ok) throw new Error(await r.text());
                  setTreasuryReady(true);
                });
              }}
              transaction={{
                cadence: zapCadence as unknown as string,
                args: ((arg: FclArgFn, t: FclType) => {
                  const types = t as {
                    Address: unknown;
                    String: unknown;
                    UFix64: unknown;
                  };
                  const identifier = String(poolCapPath).replace(
                    /^\/public\//,
                    ""
                  );
                  const owner = creator?.startsWith("0x")
                    ? creator
                    : `0x${creator}`;
                  const platformAdmin = addrs?.platformAdmin;
                  if (!platformAdmin) {
                    throw new Error(
                      "Missing platformAdmin address; run admin setup to populate addresses."
                    );
                  }
                  return [
                    arg(owner, types.Address),
                    arg(identifier, types.String),
                    arg(
                      formatUFix64(new Decimal(zapFlowIn || 0)),
                      types.UFix64
                    ),
                    arg(
                      formatUFix64(new Decimal(zapMinLpOut || 0)),
                      types.UFix64
                    ),
                    arg(vaultId, types.String),
                    arg(platformAdmin, types.Address),
                  ];
                }) as never,
                authorizations: [userAuth as never],
                limit: 9999,
              }}
              mutation={{
                mutationKey: [
                  "zap-in",
                  vaultId,
                  String(poolCapPath || ""),
                  zapFlowIn,
                  zapMinLpOut,
                ],
                onSuccess: async () => {
                  await refreshReserves();
                },
                onError: (e: unknown) => console.error("Zap in error", e),
              }}
            />
            {!addrs?.platformAdmin ? (
              <div className="text-[11px] text-amber-600 mt-2">
                Missing platformAdmin. Run admin setup so addresses are
                populated.
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={`rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3 ${
          isEmpty ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-100">
            Add Liquidity
          </div>
        </div>
        {!custody.loading && !custody.alive ? (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
            Vault custody is offline. The underlying NFT was not detected in its
            LockBox. Adding liquidity is temporarily disabled.
          </div>
        ) : null}
        {isEmpty && (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
            This pool is empty. Seed the pool first to set the initial price.
          </div>
        )}
        {!isEmpty && (
          <div className="text-[11px] text-neutral-400 leading-relaxed">
            Add liquidity to earn a share of trading fees every time someone
            swaps in this pool. The more liquidity you provide, the more you can
            earn over time. Your share of the pool determines your share of all
            accumulated fees.
          </div>
        )}
        {reserveShare > 0 && reserveFlow > 0 && (
          <div className="text-xs p-2 rounded space-y-1 bg-neutral-800/50 border border-neutral-700/50">
            <div className="font-medium text-neutral-200">
              Pool has reserves: {reserveShare.toFixed(6)} share /{" "}
              {reserveFlow.toFixed(6)} FLOW.
            </div>
            <div className="text-neutral-400">
              Enter one amount and the other will auto-calculate to maintain the
              ratio.
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Share amount (deposit)
            </div>
            <NumericInput
              id="add-share"
              placeholder="e.g. 1.0"
              value={shareIn}
              onValueChange={(v) => {
                setShareIn(v);
                const xs = Number(v);
                if (reserveShare > 0 && reserveFlow > 0 && xs > 0) {
                  const yf = new Decimal(xs).mul(reserveFlow).div(reserveShare);
                  setFlowIn(formatUFix64(yf));
                }
              }}
              className="w-full"
              decimals={8}
            />
            {suggestedFlowForShare != null ? (
              <div className="text-[11px] text-gray-500 mt-1">
                To match ratio, FLOW ≈ {suggestedFlowForShare.toFixed(6)}
              </div>
            ) : null}
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              FLOW amount (deposit)
            </div>
            <NumericInput
              id="add-flow"
              placeholder="e.g. 1.0"
              value={flowIn}
              onValueChange={(v) => {
                setFlowIn(v);
                const yf = Number(v);
                if (reserveShare > 0 && reserveFlow > 0 && yf > 0) {
                  const xs2 = new Decimal(yf)
                    .mul(reserveShare)
                    .div(reserveFlow);
                  setShareIn(formatUFix64(xs2));
                }
              }}
              className="w-full"
              decimals={8}
            />
            {suggestedShareForFlow != null ? (
              <div className="text-[11px] text-gray-500 mt-1">
                To match ratio, share ≈ {suggestedShareForFlow.toFixed(6)}
              </div>
            ) : null}
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Min LP (slippage guard)
            </div>
            <NumericInput
              id="add-minlp"
              placeholder="e.g. 0.00000001"
              value={minLpOut}
              onValueChange={setMinLpOut}
              className="w-full"
              decimals={8}
            />
            <div className="text-[11px] text-gray-500 mt-1">
              If minted LP is below this, the transaction reverts.
            </div>
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium opacity-0">
              Action
            </div>
            <TxActionButton
              label="Add Liquidity"
              variant="secondary"
              disabled={
                !(
                  addSimpleCadence &&
                  creator &&
                  poolCapPath &&
                  (Number(shareIn) > 0 || Number(flowIn) > 0)
                ) ||
                isEmpty ||
                custody.loading ||
                !custody.alive
              }
              beforeExecute={async () => {
                if (treasuryReady) return;
                const API =
                  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
                await fetch(`${API}/pools/ensure-ready`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ vaultId }),
                }).then(async (r) => {
                  if (!r.ok) throw new Error(await r.text());
                  setTreasuryReady(true);
                });
              }}
              transaction={{
                cadence: addSimpleCadence as unknown as string,
                args: ((arg: FclArgFn, t: FclType) => {
                  const types = t as {
                    Address: unknown;
                    String: unknown;
                    UFix64: unknown;
                  };
                  const identifier = String(poolCapPath).replace(
                    /^\/public\//,
                    ""
                  );
                  const owner = creator?.startsWith("0x")
                    ? creator
                    : `0x${creator}`;
                  return [
                    arg(owner, types.Address),
                    arg(identifier, types.String),
                    arg(formatUFix64(new Decimal(shareIn || 0)), types.UFix64),
                    arg(formatUFix64(new Decimal(flowIn || 0)), types.UFix64),
                    arg(formatUFix64(new Decimal(minLpOut || 0)), types.UFix64),
                  ];
                }) as never,
                authorizations: [userAuth as never],
                limit: 9999,
              }}
              mutation={{
                mutationKey: [
                  "add-liquidity-simple",
                  vaultId,
                  String(poolCapPath || ""),
                  shareIn,
                  flowIn,
                ],
                onSuccess: async () => {
                  await refreshReserves();
                },
                onError: (e: unknown) => console.error("Add simple error", e),
              }}
            />
          </div>
        </div>
      </div>

      <div
        className={`rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3 ${
          isEmpty ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-100">
            Remove Liquidity
          </div>
        </div>
        {isEmpty && (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2 text-xs text-neutral-300 border-l-2 border-l-blue-500/50">
            This pool is empty. Seed the pool first to set the initial price.
          </div>
        )}
        {!isEmpty && (
          <div className="text-[11px] text-neutral-400 leading-relaxed">
            Remove your LP tokens to get back your share and FLOW. We&apos;ll
            show you exactly what you&apos;ll receive.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              LP amount to remove
            </div>
            <NumericInput
              id="remove-lp"
              placeholder="e.g. 0.1"
              value={lpAmount}
              onValueChange={(v) => {
                setLpAmount(v);
                // Auto-calculate expected outputs and set reasonable minimums
                const lpNum = Number(v || 0);
                if (
                  lpNum > 0 &&
                  reserveShare > 0 &&
                  reserveFlow > 0 &&
                  Number(walletLP) > 0
                ) {
                  const lpRatio = lpNum / Number(walletLP);
                  const expectedShare = lpRatio * reserveShare;
                  const expectedFlow = lpRatio * reserveFlow;
                  // Set minimums to 95% of expected (5% slippage tolerance)
                  setMinShare(formatUFix64(new Decimal(expectedShare * 0.95)));
                  setMinFlow(formatUFix64(new Decimal(expectedFlow * 0.95)));
                }
              }}
              className="w-full"
              decimals={8}
            />
            {Number(walletLP) > 0 && (
              <div className="text-[11px] text-gray-500 mt-1">
                You have {Number(walletLP).toFixed(6)} LP tokens
              </div>
            )}
            {Number(walletLP) > 0 && (
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] border border-neutral-600 rounded bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 transition-colors"
                  onClick={() =>
                    setLpAmount(
                      formatUFix64(new Decimal(Number(walletLP) * 0.25))
                    )
                  }
                  title="Remove 25%"
                >
                  25%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] border border-neutral-600 rounded bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 transition-colors"
                  onClick={() =>
                    setLpAmount(
                      formatUFix64(new Decimal(Number(walletLP) * 0.5))
                    )
                  }
                  title="Remove 50%"
                >
                  50%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] border border-neutral-600 rounded bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 transition-colors"
                  onClick={() =>
                    setLpAmount(
                      formatUFix64(new Decimal(Number(walletLP) * 0.75))
                    )
                  }
                  title="Remove 75%"
                >
                  75%
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] border border-neutral-600 rounded bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 transition-colors"
                  onClick={() => setLpAmount(walletLP)}
                  title="Remove all"
                >
                  All
                </button>
              </div>
            )}
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Expected share out
            </div>
            <div className="px-3 py-2 border border-neutral-600 rounded bg-neutral-800/30 text-sm font-mono text-neutral-300">
              {Number(lpAmount) > 0 && Number(walletLP) > 0 && reserveShare > 0
                ? (
                    (Number(lpAmount) / Number(walletLP)) *
                    reserveShare
                  ).toFixed(6)
                : "0.000000"}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Min: {minShare} (5% slippage protection)
            </div>
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium">
              Expected FLOW out
            </div>
            <div className="px-3 py-2 border border-neutral-600 rounded bg-neutral-800/30 text-sm font-mono text-neutral-300">
              {Number(lpAmount) > 0 && Number(walletLP) > 0 && reserveFlow > 0
                ? ((Number(lpAmount) / Number(walletLP)) * reserveFlow).toFixed(
                    6
                  )
                : "0.000000"}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Min: {minFlow} (5% slippage protection)
            </div>
          </div>
          <div className="min-w-[10rem] space-y-1">
            <div className="text-[11px] text-gray-500 mb-1 font-medium opacity-0">
              Action
            </div>
            <TxActionButton
              label="Remove Liquidity"
              variant="secondary"
              disabled={
                !(
                  removeCadence &&
                  creator &&
                  poolCapPath &&
                  Number(lpAmount) > 0
                ) ||
                custody.loading ||
                !custody.alive
              }
              beforeExecute={async () => {
                await fetch("/pools/ensure-ready", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ vaultId }),
                }).then(async (r) => {
                  if (!r.ok) throw new Error(await r.text());
                });
              }}
              transaction={{
                cadence: removeCadence as unknown as string,
                args: ((arg: FclArgFn, t: FclType) => {
                  const types = t as {
                    Address: unknown;
                    String: unknown;
                    UFix64: unknown;
                  };
                  const identifier = String(poolCapPath).replace(
                    /^\/public\//,
                    ""
                  );
                  const owner = creator?.startsWith("0x")
                    ? creator
                    : `0x${creator}`;
                  return [
                    arg(owner, types.Address),
                    arg(identifier, types.String),
                    arg(ensureUFix64String(lpAmount), types.UFix64),
                    arg(ensureUFix64String(minShare), types.UFix64),
                    arg(ensureUFix64String(minFlow), types.UFix64),
                    arg(vaultId, types.String),
                  ];
                }) as never,
                authorizations: [userAuth as never],
                limit: 9999,
              }}
              mutation={{
                mutationKey: [
                  "remove-liquidity",
                  vaultId,
                  lpAmount,
                  minShare,
                  minFlow,
                ],
                onSuccess: async () => {
                  await refreshReserves();
                },
                onError: (e: unknown) =>
                  console.error("Remove liquidity error", e),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
