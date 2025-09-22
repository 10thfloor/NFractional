"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getFeeSchedule,
  getVaultEscrowBalance,
  getVaultTreasuryBalance,
  type Vault,
} from "@/lib/api/home";
import { getVaultNftDisplay } from "@/lib/api/vault";
import { getPoolsByVault, type Pool } from "@/lib/api/pools";
import {
  pickPrimaryPool,
  computeSharePriceFlow,
  computeTvlFlow,
} from "@/lib/market";
import { fetchListings } from "@/lib/api/listings";

type VaultCardData = {
  fee: Awaited<ReturnType<typeof getFeeSchedule>>;
  escrow: string;
  treasury: string;
  nft: Awaited<ReturnType<typeof getVaultNftDisplay>> | null;
  pools: Pool[];
  listings: Awaited<ReturnType<typeof fetchListings>>;
};

export default function VaultCard({ v }: { v: Vault }) {
  const [data, setData] = useState<VaultCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getFeeSchedule(v.vaultId),
      getVaultEscrowBalance(v.vaultId),
      getVaultTreasuryBalance(v.vaultId),
      getVaultNftDisplay(v.vaultId).catch(() => null),
      getPoolsByVault(v.vaultId).catch(() => [] as Pool[]),
      fetchListings(v.vaultId).catch(() => []),
    ])
      .then(([fee, escrow, treasury, nft, pools, listings]) => {
        if (!cancelled) {
          setData({ fee, escrow, treasury, nft, pools, listings });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [v.vaultId]);

  if (loading || !data) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
        <div className="h-44 w-full animate-pulse bg-neutral-800 rounded" />
        <div className="mt-3 space-y-2">
          <div className="h-4 w-3/4 animate-pulse bg-neutral-800 rounded" />
          <div className="h-4 w-1/2 animate-pulse bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  const { fee, treasury, nft, pools, listings } = data;

  const activeFeeBps = typeof fee?.feeBps === "number" ? fee.feeBps : 50;
  const activeVaultSplitBps =
    typeof fee?.vaultSplitBps === "number" ? fee.vaultSplitBps : 2000;
  const activeProtocolSplitBps =
    typeof fee?.protocolSplitBps === "number" ? fee.protocolSplitBps : 8000;
  const feeStr = `${activeFeeBps} bps (V ${(activeVaultSplitBps / 100).toFixed(
    2
  )}% / P ${(activeProtocolSplitBps / 100).toFixed(2)}%)`;
  // Derive price/TVL using same logic as vault page
  const poolsCount = pools.length;
  const primaryPool = poolsCount ? pickPrimaryPool(pools) : null;
  const sharePriceFlow = computeSharePriceFlow(primaryPool, v.shareSymbol);
  const tvlFlow = computeTvlFlow(pools);
  const quoteSymbol = primaryPool
    ? primaryPool.assetA === v.shareSymbol
      ? String(primaryPool.assetB || "FLOW")
      : String(primaryPool.assetA || "FLOW")
    : "FLOW";
  const priceStr =
    sharePriceFlow == null || !Number.isFinite(sharePriceFlow)
      ? "-"
      : `${sharePriceFlow.toFixed(6)} ${quoteSymbol}/${v.shareSymbol}`;
  const tvlStr =
    tvlFlow == null || !Number.isFinite(tvlFlow)
      ? "-"
      : `${tvlFlow.toFixed(2)} ${quoteSymbol}`;
  const title = nft?.name || v.shareSymbol || v.vaultId;
  const subtitle = `${v.collection ?? ""} ${
    v.tokenId ? `#${v.tokenId}` : ""
  }`.trim();
  const img = nft?.thumbnail || null;

  return (
    <div className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700 focus-within:border-neutral-600 shadow-sm hover:shadow-md hover:shadow-black/30 focus-within:ring-1 focus-within:ring-neutral-600/60 before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:rounded-md before:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_60%)] before:opacity-0 focus-within:before:opacity-100 before:transition-opacity">
      <Link
        href={`/vaults/${encodeURIComponent(v.vaultId)}`}
        className="block"
        aria-label={`Open vault ${v.vaultId}`}
      >
        <div className="relative h-44 w-full overflow-hidden bg-neutral-950">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-600 text-xs">
              No Image
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/20 to-transparent" />

          <div className="absolute left-2 top-2 flex items-center gap-2">
            {v.shareSymbol ? (
              <span className="rounded border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 text-[10px] text-neutral-200 backdrop-blur">
                {v.shareSymbol}
              </span>
            ) : null}
            {v.state ? (
              <span className="rounded border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 text-[10px] text-neutral-300 backdrop-blur">
                {v.state}
              </span>
            ) : null}
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-2">
            <span className="rounded border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 text-[10px] text-neutral-300 backdrop-blur">
              Pools: {poolsCount}
            </span>
            <span className="rounded border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 text-[10px] text-neutral-300 backdrop-blur">
              Listings:{" "}
              {
                listings.filter(
                  (l) => String(l.status || "").toLowerCase() === "open"
                ).length
              }
            </span>
          </div>

          <div className="absolute bottom-2 left-2 right-2">
            <div className="line-clamp-1 text-base font-medium text-neutral-100">
              {title}
            </div>
            <div className="line-clamp-1 text-xs text-neutral-300">
              {subtitle}
            </div>
          </div>
        </div>
      </Link>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
            <div className="text-[11px] text-neutral-500">Price</div>
            <div className="font-mono text-sm text-neutral-100">{priceStr}</div>
          </div>
          <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
            <div className="text-[11px] text-neutral-500">TVL</div>
            <div className="font-mono text-sm text-neutral-100">{tvlStr}</div>
          </div>
          <div className="col-span-2 rounded border border-neutral-800 bg-neutral-950 p-2">
            <div className="text-[11px] text-neutral-500">Fees</div>
            <div className="font-mono text-sm text-neutral-100">{feeStr}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
          <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-0.5">
            Vault Treasury: {treasury}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">
            {v.network}
          </div>
          <div className="flex items-center gap-2">
            {poolsCount > 0 ? (
              <Link
                href={`/vaults/${encodeURIComponent(v.vaultId)}/trade`}
                className="z-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:border-neutral-600 hover:text-neutral-50"
              >
                Trade
              </Link>
            ) : null}
            <Link
              href={`/vaults/${encodeURIComponent(v.vaultId)}`}
              className="z-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:border-neutral-600 hover:text-neutral-50"
            >
              Open
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
