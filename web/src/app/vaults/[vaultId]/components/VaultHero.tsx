"use client";

import { useEffect, useState } from "react";
import { getVaultNftDisplay } from "@/lib/api/vault";
import { useUserShareBalance } from "@/hooks/useUserShareBalance";
import { useUserLPBalances } from "@/hooks/useUserLPBalances";
import type { Vault } from "@/lib/api/vault";
import { computeSharePriceFlow } from "@/lib/market";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

interface VaultHeroProps {
  vault: Vault;
  maxSupply?: string | null;
  totalSupply?: string | null;
  escrowBalance?: string | null;
  lockedSeedShares?: string | null;
  teamTreasuryShares?: string | null;
  teamLPShareEquivalent?: string | null;
  treasuryShareBalance?: string | null;
  poolsSummary?: {
    count: number;
    totalLiquidity: string;
  } | null;
  primaryPool?: {
    poolId: string;
    assetA?: string | null;
    assetB?: string | null;
    reserveA?: string | null;
    reserveB?: string | null;
    feeBps?: number | null;
  } | null;
}

export default function VaultHero({
  vault,
  maxSupply,
  totalSupply,
  escrowBalance,
  lockedSeedShares,
  teamTreasuryShares,
  teamLPShareEquivalent,
  treasuryShareBalance,
  poolsSummary,
  primaryPool,
}: VaultHeroProps) {
  const [nft, setNft] = useState<{
    name?: string | null;
    description?: string | null;
    thumbnail?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Get user's share balance
  const { balance: userBalance } = useUserShareBalance(vault.vaultId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await getVaultNftDisplay(vault.vaultId);
        if (!cancelled) setNft(d ?? null);
      } catch (error) {
        console.error("Failed to fetch vault NFT display:", error);
        if (!cancelled) setNft(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault.vaultId]);

  const formatBalance = (
    balance: string | null | undefined,
    symbol = "FLOW"
  ) => {
    if (!balance || balance === "0") return "0";
    const num = Number.parseFloat(balance);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M ${symbol}`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K ${symbol}`;
    return `${num.toFixed(2)} ${symbol}`;
  };

  const formatNumber = (num: number, decimals = 2): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(decimals);
  };

  // Calculate percentage of total supply
  const userBalanceNum = Number.parseFloat(userBalance || "0");
  const maxSupplyNum = Number.parseFloat(maxSupply || "0");
  const percentage =
    maxSupplyNum > 0 ? (userBalanceNum / maxSupplyNum) * 100 : 0;

  const custodyReady = Boolean(vault.collection && vault.tokenId);
  const escrowNum = Number.parseFloat(escrowBalance || "0");
  const lockedSeedNum = Number.parseFloat(lockedSeedShares || "0");
  const teamTreasuryNum = Number.parseFloat(teamTreasuryShares || "0");
  const teamLpEqNum = Number.parseFloat(teamLPShareEquivalent || "0");
  const treasuryShareNum = Number.parseFloat(treasuryShareBalance || "0");
  const { totalLP, poolsWithLP } = useUserLPBalances(
    vault.vaultId,
    vault.shareSymbol || null
  );

  const { user } = useFlowCurrentUser();

  // Derived market data
  const sharePriceFlow = computeSharePriceFlow(
    primaryPool ?? null,
    vault.shareSymbol
  );
  const tvlFlow = poolsSummary?.totalLiquidity
    ? Number(poolsSummary.totalLiquidity)
    : null;

  // Supply and market cap
  const totalSupplyNum = Number.parseFloat(totalSupply || "0");
  const circulatingNum = Math.max(
    totalSupplyNum - escrowNum - lockedSeedNum - teamTreasuryNum - teamLpEqNum,
    0
  );
  const circulatingPct =
    maxSupplyNum > 0 ? (circulatingNum / maxSupplyNum) * 100 : null;
  const marketCapFlow =
    sharePriceFlow != null && Number.isFinite(sharePriceFlow)
      ? circulatingNum * sharePriceFlow
      : null;

  return (
    <div className="space-y-4">
      {/* Hero Section - NFT + Identity */}
      <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* NFT Image - More Prominent */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="w-32 h-32 md:w-36 md:h-36 border border-neutral-800 rounded-xl shadow-lg overflow-hidden bg-neutral-900/50 ring-1 ring-neutral-800/50">
                {loading ? (
                  <div className="w-full h-full bg-neutral-800/50 animate-pulse flex items-center justify-center">
                    <div className="text-neutral-500 text-xs">Loading...</div>
                  </div>
                ) : nft?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={nft.thumbnail}
                    alt={nft?.name || "NFT"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900/30">
                    <div className="text-center">
                      <div className="text-3xl mb-1 opacity-50">🖼️</div>
                      <div className="text-xs text-neutral-600">No Image</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vault Identity & Status */}
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-50 mb-1.5 tracking-tight">
                {nft?.name || `Vault ${vault.vaultId}`}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="font-mono text-xs text-neutral-400 px-2 py-0.5 rounded bg-neutral-800/50 border border-neutral-800">
                  {vault.vaultId}
                </span>
                <span className="text-neutral-600">•</span>
                <span className="font-mono text-xs px-2.5 py-1 rounded-md border border-neutral-800 bg-neutral-800/30 text-neutral-300">
                  {vault.shareSymbol || "SHARE"}
                </span>
              </div>

              {/* NFT Description */}
              {nft?.description && (
                <div className="text-sm text-neutral-300 leading-relaxed mb-4 max-w-2xl">
                  {nft.description}
                </div>
              )}

              {/* All NFT Metadata */}
              {(vault.tokenId ||
                vault.collection ||
                vault.creator ||
                vault.policy ||
                vault.state) && (
                <div className="pt-2 border-t border-neutral-800/50">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-x-3 gap-y-2">
                    {vault.tokenId && (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                          Token ID
                        </div>
                        <div className="font-mono text-xs text-neutral-300">
                          {vault.tokenId}
                        </div>
                      </div>
                    )}
                    {vault.collection && (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                          Collection
                        </div>
                        <div className="font-mono text-[10px] text-neutral-400 break-all">
                          {vault.collection}
                        </div>
                      </div>
                    )}
                    {vault.creator && (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                          Creator
                        </div>
                        <div className="font-mono text-[10px] text-neutral-400 break-all">
                          {vault.creator}
                        </div>
                      </div>
                    )}
                    {vault.policy && (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                          Policy
                        </div>
                        <div className="text-xs text-neutral-300">
                          {vault.policy}
                        </div>
                      </div>
                    )}
                    {vault.state && (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
                          State
                        </div>
                        <div className="text-xs text-neutral-300">
                          {vault.state}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Badges - More Prominent */}
            <div className="flex flex-wrap gap-2 pt-2">
              {custodyReady && (
                <span className="px-2.5 py-1 rounded-lg border border-green-800/40 bg-green-950/30 text-green-200 text-xs font-medium shadow-sm">
                  ✓ Ready for trading
                </span>
              )}
              {typeof poolsSummary?.count === "number" &&
                poolsSummary.count > 0 && (
                  <span className="px-2.5 py-1 rounded-lg border border-blue-800/40 bg-blue-950/20 text-blue-200 text-xs font-medium shadow-sm">
                    {poolsSummary.count} Pool
                    {poolsSummary.count === 1 ? "" : "s"}
                  </span>
                )}
              {escrowNum > 0 && (
                <span className="px-2.5 py-1 rounded-lg border border-amber-800/40 bg-amber-950/20 text-amber-200 text-xs font-medium shadow-sm">
                  Shares in custody
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Market Metrics - Prominent Top Section */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-3 space-y-1.5 shadow-sm backdrop-blur-sm">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            Price
          </div>
          <div className="font-mono text-lg font-bold text-neutral-50">
            {sharePriceFlow == null || !Number.isFinite(sharePriceFlow)
              ? "-"
              : sharePriceFlow.toFixed(6)}
          </div>
          <div className="text-[10px] text-neutral-500 font-medium">
            FLOW / {vault.shareSymbol || "SHARE"}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-3 space-y-1.5 shadow-sm backdrop-blur-sm">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            TVL
          </div>
          <div className="font-mono text-lg font-bold text-neutral-50">
            {tvlFlow == null || !Number.isFinite(tvlFlow)
              ? "-"
              : formatNumber(tvlFlow)}
          </div>
          <div className="text-[10px] text-neutral-500 font-medium">FLOW</div>
        </div>

        {marketCapFlow != null && Number.isFinite(marketCapFlow) && (
          <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-3 space-y-1.5 shadow-sm backdrop-blur-sm">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Market Cap
            </div>
            <div className="font-mono text-lg font-bold text-neutral-50">
              {formatNumber(marketCapFlow)}
            </div>
            <div className="text-[10px] text-neutral-500 font-medium">FLOW</div>
          </div>
        )}
      </div>

      {/* User Position - Prominent When Logged In */}
      {user?.loggedIn ? (
        <div className="rounded-xl border border-blue-800/40 bg-gradient-to-br from-blue-950/40 to-blue-900/30 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-800/30">
            <h2 className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
              Your Position
            </h2>
            {poolsWithLP > 0 && (
              <span className="text-[10px] text-blue-400/80 font-medium">
                {poolsWithLP} pool{poolsWithLP === 1 ? "" : "s"} with LP
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                Share Balance
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {formatBalance(userBalance, vault.shareSymbol || "SHARE")}
              </div>
              {maxSupplyNum > 0 && (
                <div className="text-[10px] text-blue-300/60">
                  {percentage.toFixed(2)}% of max supply
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                LP Tokens
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {Number(totalLP).toFixed(6)}
              </div>
              <div className="text-[10px] text-blue-300/60">
                Liquidity provider position
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                In Custody
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {formatBalance(escrowBalance, vault.shareSymbol || "SHARE")}
              </div>
              <div className="text-[10px] text-blue-300/60">
                Locked by listings
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-sm">
          <NotLoggedIn message="Connect your wallet to see your position." />
        </div>
      )}

      {/* Supply Details - Compact Section */}
      <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800/50">
          <h3 className="text-xs font-semibold text-neutral-100 uppercase tracking-wider">
            Supply
          </h3>
          {circulatingPct != null && (
            <div className="text-[10px] text-neutral-400 font-medium">
              <span className="text-neutral-200 font-semibold">
                {circulatingPct.toFixed(1)}%
              </span>{" "}
              circulating
            </div>
          )}
        </div>

        {circulatingPct != null && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, circulatingPct))}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
              Circulating
            </div>
            <div className="font-mono text-sm font-bold text-neutral-50">
              {Number.isFinite(circulatingNum)
                ? formatNumber(circulatingNum, 2)
                : "-"}
            </div>
            <div className="text-[10px] text-neutral-600 font-medium">
              {vault.shareSymbol || "SHARE"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
              Total Supply
            </div>
            <div className="font-mono text-sm font-bold text-neutral-50">
              {Number.isFinite(totalSupplyNum)
                ? formatNumber(totalSupplyNum, 2)
                : "-"}
            </div>
            <div className="text-[10px] text-neutral-600 font-medium">
              {vault.shareSymbol || "SHARE"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
              Max Supply
            </div>
            <div className="font-mono text-sm font-bold text-neutral-50">
              {maxSupplyNum > 0 ? formatNumber(maxSupplyNum, 2) : "∞"}
            </div>
            <div className="text-[10px] text-neutral-600 font-medium">
              {vault.shareSymbol || "SHARE"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
              Vault Treasury
            </div>
            <div className="font-mono text-sm font-bold text-neutral-50">
              {treasuryShareNum.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-600 font-medium">
              {vault.shareSymbol || "SHARE"}
            </div>
          </div>
        </div>

        {/* Reserved Balances - Compact */}
        {(lockedSeedNum > 0 || teamLpEqNum > 0) && (
          <div className="pt-3 border-t border-neutral-800/50">
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Additional Reserves
            </div>
            <div className="grid grid-cols-2 gap-3">
              {lockedSeedNum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-400">
                    Locked seed:
                  </span>
                  <span className="font-mono text-xs font-semibold text-neutral-200">
                    {lockedSeedNum.toFixed(2)}
                  </span>
                </div>
              )}
              {teamLpEqNum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-400">Team LP:</span>
                  <span className="font-mono text-xs font-semibold text-neutral-200">
                    {teamLpEqNum.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pool Details - Compact */}
      {primaryPool && (
        <div className="rounded-xl border border-blue-800/40 bg-gradient-to-br from-blue-950/40 to-blue-900/30 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-800/30">
            <h3 className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
              Active Pool
            </h3>
            <span className="font-mono text-[10px] text-blue-400/80 font-medium">
              #{primaryPool.poolId}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                Pair
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {primaryPool.assetA} / {primaryPool.assetB}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                Fee
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {primaryPool.feeBps ?? 0} bps
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wide">
                Reserves
              </div>
              <div className="font-mono text-base font-bold text-blue-50">
                {formatNumber(Number(primaryPool.reserveA || 0), 2)} /{" "}
                {formatNumber(Number(primaryPool.reserveB || 0), 2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
