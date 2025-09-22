import ListingFeesPanel from "../components/fees/ListingFeesPanel";
import AmmFeesPanel from "../components/fees/AMMFeesPanel";
import { getVault } from "@/lib/api/vault";

export default async function FeesPage({
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
        View current fee schedule, propose updates, and review fee events.
      </div>
      <ListingFeesPanel vaultId={vault.vaultId} creator={vault.creator} />
      <AmmFeesPanel vaultId={vault.vaultId} />
    </section>
  );
}
