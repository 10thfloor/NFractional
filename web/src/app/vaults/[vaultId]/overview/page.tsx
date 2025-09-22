import ActivityFeed from "../ActivityFeed";
import { getVault } from "@/lib/api/vault";

export default async function OverviewPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  const vault = await getVault(vaultId);
  if (!vault) return null;

  return (
    <section className="space-y-4">
      <ActivityFeed vaultId={vault.vaultId} />
    </section>
  );
}
