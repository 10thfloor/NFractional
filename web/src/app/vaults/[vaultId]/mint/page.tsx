import MintPanel from "../components/MintPanel";
import {
  getVault,
  getVaultMaxSupply,
  getVaultTotalSupply,
} from "@/lib/api/vault";

export default async function MintPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) return null;

  // Fetch supply data for mint UI
  const [maxSupply, totalSupply] = await Promise.all([
    getVaultMaxSupply(vaultId).catch(() => null),
    getVaultTotalSupply(vaultId).catch(() => null),
  ]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Mint shares directly to the vault treasury. Shares can be used for
        distributions or other purposes. Only platform admins can mint shares.
      </div>
      <MintPanel
        vaultId={vault.vaultId}
        vaultSymbol={vault.shareSymbol ?? ""}
        creator={vault.creator ?? ""}
        maxSupply={maxSupply ?? null}
        totalSupply={totalSupply ?? null}
      />
    </section>
  );
}
