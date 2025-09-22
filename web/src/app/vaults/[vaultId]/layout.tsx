import TabNav from "./components/TabNav";
import VaultHero from "./components/VaultHero";
import VaultShareSetupRow from "./components/VaultShareSetupRow";
import {
  getVault,
  getPlatformAdmin,
  getEscrowBalance,
  getVaultMaxSupply,
  getVaultTotalSupply,
  getVaultLockedSeedShares,
  getVaultTeamShareBalances,
  getVaultTeamLPShareEquivalent,
} from "@/lib/api/vault";
import { getPoolsByVault } from "@/lib/api/pools";
import { Suspense } from "react";
import {
  getVaultTreasuryShareBalance,
} from "@/lib/api/home";
import PageContainer from "@/app/components/PageContainer";

export default async function VaultLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) {
    return <PageContainer>Vault not found.</PageContainer>;
  }
  const adminAddr = await getPlatformAdmin();
  const [
    maxSupplyChain,
    totalSupply,
    escrowBalance,
    pools,
    treasuryShareBalance,
  ] = await Promise.all([
    getVaultMaxSupply(vaultId),
    getVaultTotalSupply(vaultId),
    adminAddr ? getEscrowBalance(vaultId, adminAddr) : Promise.resolve(null),
    getPoolsByVault(vaultId),
    getVaultTreasuryShareBalance(vaultId).catch(() => "0"),
  ]);

  const [lockedSeed, teamShares, teamLpEq] = await Promise.all([
    getVaultLockedSeedShares(vaultId).catch(() => "0"),
    getVaultTeamShareBalances(vaultId).catch(() => "0"),
    getVaultTeamLPShareEquivalent(vaultId).catch(() => "0"),
  ]);

  const poolsSummary =
    pools.length > 0
      ? {
          count: pools.length,
          totalLiquidity: pools
            .reduce((sum, pool) => {
              const reserveA = Number.parseFloat(pool.reserveA || "0");
              const reserveB = Number.parseFloat(pool.reserveB || "0");
              return sum + reserveA + reserveB;
            }, 0)
            .toString(),
        }
      : null;

  // Choose a primary pool to summarize in the header (largest liquidity)
  const primaryPool = pools.length
    ? pools.reduce((best, p) => {
        const bestTVL = Number(best.reserveA || 0) + Number(best.reserveB || 0);
        const tvl = Number(p.reserveA || 0) + Number(p.reserveB || 0);
        return tvl > bestTVL ? p : best;
      }, pools[0])
    : null;

  return (
    <PageContainer>
      <VaultShareSetupRow
        vaultId={vault.vaultId}
        vaultSymbol={vault.shareSymbol ?? ""}
      />
      <VaultHero
        vault={vault}
        maxSupply={maxSupplyChain}
        totalSupply={totalSupply}
        escrowBalance={escrowBalance}
        lockedSeedShares={lockedSeed}
        teamTreasuryShares={teamShares}
        teamLPShareEquivalent={teamLpEq}
        treasuryShareBalance={treasuryShareBalance}
        poolsSummary={poolsSummary}
        primaryPool={primaryPool}
      />
      <TabNav vaultId={vaultId} />
      <Suspense>{children}</Suspense>
    </PageContainer>
  );
}
