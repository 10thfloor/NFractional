import { redirect } from "next/navigation";

export default async function VaultPage({
  params,
}: {
  params: { vaultId: string };
}) {
  const { vaultId } = await params;
  redirect(`/vaults/${vaultId}/overview`);
}
