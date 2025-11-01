"use client";

import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import { useVaultFTMeta } from "@/hooks/useVaultFTMeta";
import { useShareSetup } from "@/hooks/useShareSetup";
import ShareSetupCard from "./ShareSetupCard";
import { useState } from "react";

export default function VaultShareSetupRow({
  vaultId,
  vaultSymbol,
}: {
  vaultId: string;
  vaultSymbol: string;
}) {
  const fcl = useFlowClient();
  const { user } = useFlowCurrentUser();
  const flowAddrs = useFlowAddresses();
  const { adminReady } = useAdminInfo();
  const { ftMeta } = useVaultFTMeta(vaultId);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasShareSetup = useShareSetup(
    user?.addr,
    vaultSymbol,
    (flowAddrs as unknown as { ft?: string }).ft,
    fcl
  );

  // Hide if user is logged in and already set up
  if (user?.loggedIn && hasShareSetup) {
    return null;
  }

  return (
    <div className="border rounded divide-y">
      <ShareSetupCard
        vaultSymbol={vaultSymbol}
        hasShareSetup={hasShareSetup}
        shareTokenMeta={ftMeta}
        flowAddrs={flowAddrs as unknown as Record<string, unknown>}
        disabled={!adminReady}
        onSuccess={(txId: string) =>
          setSuccess("Transaction submitted successfully!")
        }
        onError={(e: unknown) => setLocalError((e as Error).message)}
      />
      {/* Optional small status row */}
      {(localError || success) && (
        <div className="p-2 text-xs">
          {localError ? (
            <span className="text-red-600">{localError}</span>
          ) : (
            <span className="text-green-700">{success}</span>
          )}
        </div>
      )}
    </div>
  );
}
