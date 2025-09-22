import ListingsPanel from "../ListingsPanel";
import { getVault } from "@/lib/api/vault";

export default async function ListingsPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) return null;
  const custodyReady = Boolean(vault.collection && vault.tokenId);
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Create and manage fixed-price listings for vault shares. Ensure your
        share setup is complete and custody is ready before listing. Sales
        settle atomically on-chain.
      </div>
      <ListingsPanel
        vaultId={vault.vaultId}
        vaultSymbol={vault.shareSymbol ?? ""}
        creator={vault.creator ?? ""}
        custodyReady={custodyReady}
      />
    </section>
  );
}
