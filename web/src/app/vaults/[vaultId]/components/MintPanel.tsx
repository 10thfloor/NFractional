"use client";

import { useFlowCurrentUser } from "@onflow/react-sdk";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import MintSharesCard from "./MintSharesCard";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

export default function MintPanel({
  vaultId,
  vaultSymbol,
  maxSupply,
  totalSupply,
}: {
  vaultId: string;
  vaultSymbol: string;
  creator: string;
  maxSupply?: string | null;
  totalSupply?: string | null;
}) {
  const { user } = useFlowCurrentUser();
  const { adminReady } = useAdminInfo();

  if (!user?.loggedIn) {
    return <NotLoggedIn message="Connect your wallet to mint shares." />;
  }

  if (!adminReady) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Only platform admins can mint shares to the vault treasury.
      </div>
    );
  }

  return (
    <MintSharesCard
      vaultId={vaultId}
      vaultSymbol={vaultSymbol}
      maxSupply={maxSupply ?? null}
      currentSupply={totalSupply ?? null}
      onSuccess={() => {
        // Could refresh balances or show success message
      }}
    />
  );
}

