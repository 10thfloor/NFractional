import type { Pool } from "@/lib/api/pools";

export type PrimaryPool = Pick<
  Pool,
  "assetA" | "assetB" | "reserveA" | "reserveB" | "feeBps" | "poolId"
> | null;

export function pickPrimaryPool(pools: Pool[]): PrimaryPool {
  if (!pools || pools.length === 0) return null;
  return pools.reduce((best, p) => {
    const bestTVL = Number(best.reserveA || 0) + Number(best.reserveB || 0);
    const tvl = Number(p.reserveA || 0) + Number(p.reserveB || 0);
    return tvl > bestTVL ? p : best;
  }, pools[0]);
}

export function computeSharePriceFlow(
  primaryPool: PrimaryPool,
  shareSymbol?: string | null
): number | null {
  if (!primaryPool) return null;
  const reserveA = Number(primaryPool.reserveA || 0);
  const reserveB = Number(primaryPool.reserveB || 0);
  if (!(reserveA > 0) || !(reserveB > 0)) return null;
  const quoteIsB = primaryPool.assetA === shareSymbol;
  const price = quoteIsB
    ? reserveB / Math.max(reserveA, 1e-12)
    : reserveA / Math.max(reserveB, 1e-12);
  return Number.isFinite(price) ? price : null;
}

export function computeTvlFlow(pools: Pool[]): number | null {
  if (!pools || pools.length === 0) return null;
  const total = pools.reduce((sum, p) => {
    const a = Number(p.reserveA || 0);
    const b = Number(p.reserveB || 0);
    return sum + a + b;
  }, 0);
  return Number.isFinite(total) ? total : null;
}
