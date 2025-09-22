import Link from "next/link";
import {
  getFeeSchedule,
  getVaultEscrowBalance,
  getPriceTvl,
  getVaultTreasuryBalance,
  getPoolsByAssetCount,
  type Vault,
} from "@/lib/api/home";
import { getVaultNftDisplay } from "@/lib/api/vault";

export default async function VaultRow({ v }: { v: Vault }) {
  const [fee, escrow, priceTvl, treasury, poolsCount, nft] = await Promise.all([
    getFeeSchedule(v.vaultId),
    getVaultEscrowBalance(v.vaultId),
    v.shareSymbol ? getPriceTvl(v.shareSymbol) : Promise.resolve(null),
    getVaultTreasuryBalance(v.vaultId),
    v.shareSymbol ? getPoolsByAssetCount(v.shareSymbol) : Promise.resolve(0),
    getVaultNftDisplay(v.vaultId).catch(() => null),
  ]);

  const activeFeeBps = typeof fee?.feeBps === "number" ? fee.feeBps : 50;
  const activeVaultSplitBps =
    typeof fee?.vaultSplitBps === "number" ? fee.vaultSplitBps : 2000;
  const activeProtocolSplitBps =
    typeof fee?.protocolSplitBps === "number" ? fee.protocolSplitBps : 8000;
  const feeStr = `${activeFeeBps} bps (V ${(activeVaultSplitBps / 100).toFixed(
    2
  )}% / P ${(activeProtocolSplitBps / 100).toFixed(2)}%)`;
  const priceStr = priceTvl?.price ?? "-";
  const tvlStr = priceTvl?.tvl ?? "-";

  return (
    <li className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-5 flex gap-3 items-center">
          <div className="w-14 h-14 rounded border border-neutral-800 bg-neutral-900 overflow-hidden flex-shrink-0">
            {nft?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nft.thumbnail}
                alt={nft?.name || "NFT"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
                No Image
              </div>
            )}
          </div>
          <div>
            <div className="font-medium text-neutral-100">
              {nft?.name || v.vaultId}
            </div>
            <div className="text-sm text-neutral-400">
              {v.collection} #{v.tokenId} • {v.shareSymbol} • {v.state}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-500">
              <span className="rounded border border-neutral-700 px-2 py-0.5">
                Pools: {poolsCount}
              </span>
              <span className="rounded border border-neutral-700 px-2 py-0.5">
                Escrow: {escrow}
              </span>
            </div>
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-neutral-800 bg-neutral-900 p-2">
              <div className="text-[11px] text-neutral-500">Price</div>
              <div className="font-mono text-neutral-100 text-sm">
                {priceStr}
              </div>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-900 p-2">
              <div className="text-[11px] text-neutral-500">TVL</div>
              <div className="font-mono text-neutral-100 text-sm">{tvlStr}</div>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-900 p-2 col-span-2">
              <div className="text-[11px] text-neutral-500">
                Fees (schedule) • Treasury (on-chain)
              </div>
              <div className="font-mono text-neutral-100 text-sm">
                {feeStr} • {treasury}
              </div>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 flex md:justify-end">
          <Link
            href={`/vaults/${encodeURIComponent(v.vaultId)}`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Open
          </Link>
        </div>
      </div>
    </li>
  );
}
