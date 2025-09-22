"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listAllPools, type AllPoolsItem } from "@/lib/api/pools";
import PoolCard from "./components/PoolCard";
import PageContainer from "@/app/components/PageContainer";

type UiPool = AllPoolsItem & { status: "ACTIVE" | "PAUSED" };

export default function PoolsIndex() {
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortBy, setSortBy] = useState<
    "TVL_DESC" | "VOL24H_DESC" | "PRICE_DESC"
  >("TVL_DESC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AllPoolsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listAllPools({ limit: 50 });
        if (cancelled) return;
        setRows(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const withStatus: UiPool[] = rows.map((r) => ({
      ...r,
      status:
        Number(String(r.reserveA || "0")) > 0 ||
        Number(String(r.reserveB || "0")) > 0
          ? "ACTIVE"
          : "PAUSED",
    }));
    let arr = withStatus;
    if (onlyActive) arr = arr.filter((p) => p.status === "ACTIVE");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          String(p.assetA || "")
            .toLowerCase()
            .includes(q) ||
          String(p.assetB || "")
            .toLowerCase()
            .includes(q) ||
          String(p.poolId || "")
            .toLowerCase()
            .includes(q)
      );
    }
    return arr;
  }, [rows, query, onlyActive]);

  // Derived stats (approximate)
  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(
      (r) =>
        Number(String(r.reserveA || "0")) > 0 ||
        Number(String(r.reserveB || "0")) > 0
    ).length;
    const approxTVL = rows.reduce((sum, r) => {
      const a = Number(String(r.reserveA || "0"));
      const b = Number(String(r.reserveB || "0"));
      const p = a > 0 ? b / a : 0;
      return sum + b + (a > 0 ? a * p : 0);
    }, 0);
    return { total, active, approxTVL };
  }, [rows]);

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Pools</h1>
        <div className="text-xs text-neutral-400">
          Swap Fractions <span className="text-neutral-500">&lt;-&gt;</span>{" "}
          Other Tokens
        </div>
      </div>

      {/* Quick Stats (compact) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {stats.active}
          </div>
          <div className="text-[10px] text-neutral-400">Active Pools</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {stats.total}
          </div>
          <div className="text-[10px] text-neutral-400">Total Pools</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {Math.round(stats.approxTVL).toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-400">Approx. TVL</div>
        </div>
      </div>

      {/* Filters / Controls */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-md p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div className="md:col-span-2">
            <label
              htmlFor="pool-search"
              className="block text-[11px] text-neutral-400 mb-1"
            >
              Search pools (symbol, pair, id)
            </label>
            <input
              id="pool-search"
              className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-100 placeholder:text-neutral-500"
              placeholder="e.g. MOON, FLOW/MOON, POOL-VAULT-001"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="pool-sort"
              className="block text-[11px] text-neutral-400 mb-1"
            >
              Sort by
            </label>
            <select
              id="pool-sort"
              className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-100"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="TVL_DESC">TVL (high → low)</option>
              <option value="VOL24H_DESC">24h Volume (high → low)</option>
              <option value="PRICE_DESC">Price (high → low)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 self-center mt-4">
            <input
              id="onlyActive"
              type="checkbox"
              className="h-4 w-4"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            <label
              htmlFor="onlyActive"
              className="text-[11px] text-neutral-300 mx-3"
            >
              Show only active pools
            </label>
          </div>
        </div>
      </div>

      {/* Loading / Error / Empty State */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400">Loading pools…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : null}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-md">
          <div className="text-neutral-300 mb-2">
            No pools match your filters.
          </div>
          <div className="text-neutral-500 text-sm mb-4">
            Try clearing filters or explore vaults to create a pool.
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/marketplace">Explore Marketplace</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/vaults">View Vaults</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((p) => (
            <PoolCard
              key={`${p.vaultId}:${p.poolId}`}
              data={{
                vaultId: String(p.vaultId),
                poolId: String(p.poolId),
                owner: String(p.owner || ""),
                assetA: p.assetA,
                assetB: p.assetB,
                reserveA: p.reserveA,
                reserveB: p.reserveB,
                feeBps: p.feeBps,
              }}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
