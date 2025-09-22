import DistributionsPanel from "../components/DistributionsPanel";
import { getVault } from "@/lib/api/vault";

export default async function DistributionsPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) return null;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Schedule and review distributions to share holders. Distributions use
        Flow Scheduled Transactions to automatically execute at the scheduled
        time. Recipients are fetched from the database when the distribution
        executes.
      </div>
      <DistributionsPanel
        vaultId={vault.vaultId}
        vaultSymbol={vault.shareSymbol ?? ""}
        creator={vault.creator ?? ""}
      />
    </section>
  );
}
