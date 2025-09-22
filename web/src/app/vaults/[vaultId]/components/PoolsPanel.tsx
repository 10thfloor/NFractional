"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getPoolsByVault, type Pool } from "@/lib/api/pools";
import LiquidityPanel from "./LiquidityPanel";
import PoolCard from "@/app/pools/components/PoolCard";

export default function PoolsPanel({
  vaultId,
}: {
  vaultId: string;
  creator?: string | null;
}) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  async function refreshPools() {
    try {
      const ps = await getPoolsByVault(vaultId, 25);
      setPools(ps);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  // Swap UI removed from Manage Liquidity per IA

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPoolsByVault(vaultId, 25)
      .then((ps) => {
        if (!cancelled) setPools(ps);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  // Seed UI moved into LiquidityPanel; no seeding here

  const togglePoolExpansion = (poolId: string) => {
    setExpandedPools((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(poolId)) {
        newSet.delete(poolId);
      } else {
        newSet.add(poolId);
      }
      return newSet;
    });
  };

  // no-op

  if (loading) return null;
  if (error)
    return (
      <div className="rounded border p-3 text-xs text-red-500">{error}</div>
    );
  if (!pools?.length) return null;

  return (
    <div className="rounded border p-3">
      <div className="text-sm font-semibold mb-2">Pools</div>
      <div className="space-y-3">
        {pools.map((p) => {
          const isExpanded = expandedPools.has(p.poolId);
          const reserveA = Number(p.reserveA || 0);
          const reserveB = Number(p.reserveB || 0);
          return (
            <div key={p.poolId} className="space-y-2">
              <PoolCard
                data={{
                  vaultId,
                  poolId: p.poolId,
                  owner: String(p.owner || ""),
                  assetA: p.assetA,
                  assetB: p.assetB,
                  reserveA: p.reserveA,
                  reserveB: p.reserveB,
                  feeBps: p.feeBps,
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => togglePoolExpansion(p.poolId)}
                >
                  {isExpanded ? "Hide Liquidity" : "Manage Liquidity"}
                </Button>
              </div>
              {isExpanded && (
                <div className="pt-2">
                  <LiquidityPanel
                    vaultId={vaultId}
                    poolId={p.poolId}
                    poolReserves={{
                      share: reserveA,
                      flow: reserveB,
                    }}
                    onReservesUpdated={async () => {
                      await refreshPools();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
