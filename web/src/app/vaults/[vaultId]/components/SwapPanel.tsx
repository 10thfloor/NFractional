"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowCurrentUser, useFlowClient } from "@onflow/react-sdk";
import TxActionButton from "@/app/components/TxActionButton";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { getAmmQuoteWithFees } from "@/lib/api/pools";
import { buildSwapArgs } from "@/lib/buildSwapArgs";
import { swapViaActionsTxAliased } from "@/lib/tx/amm";
import { Decimal, formatUFix64 } from "@/lib/num";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import NotLoggedIn from "@/components/ui/NotLoggedIn";
import type { FclClient, FclArgFn, FclType } from "@/lib/types/fcl";

type Direction = "share_to_flow" | "flow_to_share";

export default function SwapPanel({
  vaultId,
  vaultSymbol,
  poolId,
  poolOwner,
}: {
  vaultId: string;
  vaultSymbol: string;
  poolId: string;
  poolOwner: string;
}) {
  const { user } = useFlowCurrentUser();
  const addrs = useFlowAddresses();
  const fcl = useFlowClient() as unknown as FclClient;

  const [direction, setDirection] = useState<Direction>("flow_to_share");
  const [amountIn, setAmountIn] = useState<string>("");
  const [minOut, setMinOut] = useState<string>("0.0");
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteKey, setQuoteKey] = useState<string>("");
  const [slippagePct, setSlippagePct] = useState<string>("1.0");
  const poolCapPath = `/public/AMM_Pool_${poolId}`;
  const [swapCadence, setSwapCadence] = useState<string | null>(null);

  // Custody status gate
  const custody = useVaultCustodyStatus(vaultId, fcl);

  // No client treasury preflight; server auto‑provisions at vault setup
  const platformAdmin = addrs.platformAdmin
    ? addrs.platformAdmin.startsWith("0x")
      ? addrs.platformAdmin
      : `0x${addrs.platformAdmin}`
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await swapViaActionsTxAliased(vaultId);
        if (!cancelled) setSwapCadence(c);
      } catch {
        if (!cancelled) setSwapCadence(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  // (treasury provisioning is handled server-side)

  // directionTag is passed as a string to Cadence: "share_to_flow" | "flow_to_share"

  // Live quote with debounce and stale protection, update minOut from quote
  useEffect(() => {
    let cancelled = false;
    const amt = Number(amountIn);
    const pid = String(poolCapPath || "").replace(/^\/public\/AMM_Pool_/, "");
    const key = `${poolOwner}|${pid}|${direction}|${amt}`;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!poolCapPath || !poolOwner || !amt || amt <= 0) {
          if (!cancelled) {
            setQuoteOut(null);
            setMinOut("0.0");
            setQuoteKey("");
            setQuoteLoading(false);
          }
          return;
        }
        const res = await getAmmQuoteWithFees({
          poolOwner,
          poolId: pid,
          direction,
          amountIn: String(amt),
          vaultId,
        });
        if (cancelled) return;
        const currentAmt = Number(amountIn);
        const currentKey = `${poolOwner}|${pid}|${direction}|${currentAmt}`;
        if (currentKey !== key) return;
        setQuoteOut(String(res.out));
        const pct = Number(slippagePct);
        const factor = new Decimal(100).minus(pct).div(100);

        // adaptive epsilon: max(1e-8, out * 1e-6)
        const outDec = new Decimal(String(res.out || "0"));
        const adaptive = Decimal.max(
          new Decimal("0.00000001"),
          outDec.mul("0.000001")
        );

        // minOut = fee-aware out * (1 - slippage) - adaptive buffer
        const min = outDec.mul(factor).minus(adaptive);
        setMinOut(formatUFix64(min));
        setQuoteKey(key);
      } catch {
        if (!cancelled) {
          setQuoteOut(null);
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
  }, [amountIn, slippagePct, poolCapPath, poolOwner, direction, vaultId]);

  // Load wallet balances (FLOW, share, LP)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.addr) return;
        // Use the passed poolId directly
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
              arg(poolId, types.Optional(types.String)),
            ];
          },
        })) as Record<string, string>;
        if (cancelled || !res) return;
        // Wallet balances loaded but not displayed in UI
      } catch {
        if (!cancelled) {
          // ignore errors
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, vaultSymbol, poolId, fcl]);

  if (user && !user.loggedIn) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">
          Pool Swap
        </div>
        <NotLoggedIn message="Connect your wallet to swap tokens." />
      </div>
    );
  }

  const disabled =
    !poolOwner ||
    !swapCadence ||
    !amountIn ||
    Number(amountIn) <= 0 ||
    !platformAdmin ||
    custody.loading ||
    !custody.alive;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-4">
      <div className="pb-2 border-b border-neutral-800/50">
        <div className="text-sm font-semibold text-neutral-200 uppercase tracking-wider mb-1">
          Pool Swap
        </div>
        <div className="text-sm text-neutral-400">
          Swap FLOW ↔ shares. Set a minimum out to guard slippage; the swap
          reverts if the price moves unfavorably.
        </div>
      </div>
      {!custody.loading && !custody.alive ? (
        <div className="rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-3 text-sm text-yellow-200">
          Vault custody is offline. The underlying NFT was not detected in its
          LockBox. Swaps are temporarily disabled until custody is restored.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={direction}
          onValueChange={(v) => setDirection(v as Direction)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="flow_to_share">FLOW → {vaultSymbol}</SelectItem>
            <SelectItem value="share_to_flow">{vaultSymbol} → FLOW</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Amount in"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          className="w-32"
        />
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Min out"
          value={minOut}
          onChange={(e) => setMinOut(e.target.value)}
          className="w-32"
        />
        <div className="flex items-center gap-1">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Slippage %"
            value={slippagePct}
            onChange={(e) => setSlippagePct(e.target.value)}
            className="w-20"
          />
          <button
            type="button"
            className="text-xs px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/50 rounded-md text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            onClick={() => setSlippagePct("0.1")}
            title="Set 0.1%"
          >
            0.1%
          </button>
          <button
            type="button"
            className="text-xs px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/50 rounded-md text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            onClick={() => setSlippagePct("0.5")}
            title="Set 0.5%"
          >
            0.5%
          </button>
          <button
            type="button"
            className="text-xs px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/50 rounded-md text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            onClick={() => setSlippagePct("1.0")}
            title="Set 1%"
          >
            1%
          </button>
        </div>
        <TxActionButton
          label="Swap"
          variant="secondary"
          disabled={
            disabled ||
            !swapCadence ||
            !quoteOut ||
            quoteLoading ||
            quoteKey.length === 0
          }
          transaction={{
            cadence: swapCadence as unknown as string,
            args: ((arg: FclArgFn, t: FclType) =>
              buildSwapArgs({
                owner: poolOwner,
                poolId,
                direction,
                amountIn,
                slippagePct,
                useID: true,
                vaultId,
                platformAdmin: platformAdmin as string,
              })(arg, t)) as never,
            limit: 9999,
          }}
          mutation={{
            mutationKey: ["swap", vaultId, direction, amountIn, minOut],
            onError: (e: unknown) => console.error("Swap error", e),
          }}
        />
      </div>
    </div>
  );
}
