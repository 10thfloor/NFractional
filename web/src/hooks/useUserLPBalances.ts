"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";
import { getPoolsByVault, type Pool } from "@/lib/api/pools";
import { Decimal } from "@/lib/num";

type PerPool = { poolId: string; lp: string };

export function useUserLPBalances(vaultId: string, vaultSymbol: string | null) {
  const { user } = useFlowCurrentUser();
  const fcl = useFlowClient();
  const [perPool, setPerPool] = useState<PerPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.addr || !vaultId || !vaultSymbol) {
        setPerPool([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const pools: Pool[] = await getPoolsByVault(vaultId, 50);
        if (!pools?.length) {
          if (!cancelled) setPerPool([]);
          return;
        }
        const results: PerPool[] = [];
        for (const p of pools) {
          const res = (await (fcl as any).query({
            cadence: await getWalletBalancesScriptAliased(),
            args: (arg: (v: unknown, t: any) => unknown, t: any) => [
              arg(user.addr, t.Address),
              arg(vaultSymbol, t.String),
              arg(p.poolId, t.Optional(t.String)),
            ],
          })) as Record<string, string>;
          results.push({ poolId: p.poolId, lp: String(res?.lp ?? "0.0") });
        }
        if (!cancelled) setPerPool(results);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setPerPool([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, fcl, vaultId, vaultSymbol]);

  const totalLP = useMemo(() => {
    return perPool.reduce(
      (acc, r) => acc.plus(new Decimal(r.lp || "0")),
      new Decimal(0)
    );
  }, [perPool]);

  const poolsWithLP = useMemo(
    () => perPool.filter((r) => new Decimal(r.lp || "0").gt(0)).length,
    [perPool]
  );

  return {
    loading,
    error,
    perPool,
    totalLP: totalLP.toFixed(8),
    poolsWithLP,
    hasLP: totalLP.gt(0),
  } as const;
}
