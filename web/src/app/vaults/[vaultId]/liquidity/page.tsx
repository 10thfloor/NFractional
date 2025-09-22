import LiquidityPanel from "../components/LiquidityPanel";
import CreatePoolPanel from "../components/CreatePoolPanel";
import { getVault } from "@/lib/api/vault";
import { getPoolsByVault } from "@/lib/api/pools";

export default async function LiquidityPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) return null;
  const pools = await getPoolsByVault(vaultId, 25);
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Provide liquidity to earn trading fees. Expand a pool to add or remove
        liquidity. Seed empty pools if you are the creator.
      </div>
      {!pools?.length ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300 border-l-2 border-l-blue-500/50">
          No pools yet. As the vault creator you can create the first pool below
          to enable trading and liquidity.
        </div>
      ) : null}
      {pools?.length ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-sm font-semibold mb-3 text-neutral-200">
            <span className="text-xs text-neutral-400 font-medium">
              Pool {pools[0].poolId}: {pools[0].assetA} / {pools[0].assetB} (fee{" "}
              {pools[0].feeBps} bps)
            </span>
          </div>
          <LiquidityPanel
            vaultId={vault.vaultId}
            poolId={pools[0].poolId}
            poolReserves={{
              share: Number(pools[0].reserveA || 0),
              flow: Number(pools[0].reserveB || 0),
            }}
          />
        </div>
      ) : (
        <CreatePoolPanel
          vaultId={vault.vaultId}
          vaultSymbol={vault.shareSymbol ?? ""}
          creator={vault.creator ?? ""}
        />
      )}
    </section>
  );
}
