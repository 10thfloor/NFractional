"use client";

import { useEffect, useMemo, useState } from "react";
import PoolCard from "@/app/pools/components/PoolCard";
import { getPoolsByVault, type Pool } from "@/lib/api/pools";
import { useParams } from "next/navigation";
import { getVault } from "@/lib/api/vault";

export default function TradePage() {
  const params = useParams();
  const vaultId = String(params?.vaultId || "");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creator, setCreator] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ps = await getPoolsByVault(vaultId, 25);
        if (!cancelled) {
          setPools(ps);
          setSelected(ps[0]?.poolId ?? null);
          try {
            const v = await getVault(vaultId);
            if (!cancelled) setCreator(v?.creator ?? null);
          } catch {
            if (!cancelled) setCreator(null);
          }
        }
      } catch {
        if (!cancelled) setPools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  const activePool = useMemo(
    () => pools.find((p) => p.poolId === selected) || null,
    [pools, selected]
  );

  if (!pools.length) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
          No pools available for trading yet. Create or wait for a pool in the
          Liquidity tab.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {pools.length > 1 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex gap-2 items-center text-sm">
            <span className="text-neutral-400 font-medium">Select pool:</span>
            <select
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {pools.map((p) => (
                <option key={p.poolId} value={p.poolId}>
                  {p.assetA} / {p.assetB} (fee {p.feeBps} bps)
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {activePool ? (
        <div className="w-full max-w-2xl">
          <PoolCard
            data={{
              vaultId,
              poolId: activePool.poolId,
              owner: String(activePool.owner || creator || ""),
              assetA: activePool.assetA,
              assetB: activePool.assetB,
              reserveA: activePool.reserveA,
              reserveB: activePool.reserveB,
              feeBps: activePool.feeBps,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
