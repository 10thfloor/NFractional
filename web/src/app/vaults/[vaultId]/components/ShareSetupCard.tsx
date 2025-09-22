"use client";

import { useFlowClient } from "@onflow/react-sdk";
import TxActionButton from "@/app/components/TxActionButton";
import { useEffect, useState } from "react";
import type { ShareTokenMeta } from "@/types/listings";
import type { CadenceAddrsStd } from "@/lib/flow";
import { setupSharesTxAliased } from "@/lib/tx/listings";

export default function ShareSetupCard({
  vaultSymbol,
  hasShareSetup,
  shareTokenMeta,
  flowAddrs,
  custodyReady,
  disabled,
  onSuccess,
  onError,
}: {
  vaultSymbol: string;
  hasShareSetup: boolean;
  shareTokenMeta: ShareTokenMeta | null;
  flowAddrs: CadenceAddrsStd;
  custodyReady?: boolean;
  disabled?: boolean;
  onSuccess?: (txId: string) => void;
  onError?: (e: unknown) => void;
}) {
  const fcl = useFlowClient();
  const [setupSharesPending, setSetupSharesPending] = useState(false);
  const [cadence, setCadence] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!shareTokenMeta || !flowAddrs) {
          setCadence("");
          return;
        }
        const c = await setupSharesTxAliased(shareTokenMeta, flowAddrs);
        if (!cancelled) setCadence(c);
      } catch {
        if (!cancelled) setCadence("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareTokenMeta, flowAddrs]);

  return (
    <div className="p-3 flex items-center justify-between gap-2">
      {custodyReady ? (
        <div className="text-base font-medium text-green-700">
          Custody ready
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-700">
            If you are new to {vaultSymbol}, set up your share vault first.
          </div>
          <TxActionButton
            type="button"
            variant="secondary"
            label={
              setupSharesPending
                ? "Setting up…"
                : hasShareSetup
                ? `${vaultSymbol} Shares Ready`
                : `Setup ${vaultSymbol} Shares`
            }
            disabled={Boolean(disabled) || hasShareSetup || setupSharesPending}
            transaction={{
              cadence,
              args: () => [],
              authorizations: [
                (
                  fcl as unknown as {
                    currentUser(): { authorization: unknown };
                  }
                ).currentUser().authorization as unknown as never,
              ],
              limit: 9999,
            }}
            mutation={{
              mutationKey: ["setup-shares", vaultSymbol],
              onMutate: () => setSetupSharesPending(true),
              onSuccess: async (txId: string) => {
                try {
                  onSuccess?.(txId);
                } catch (e) {
                  onError?.(e);
                }
              },
              onError: (e: unknown) => onError?.(e),
              onSettled: () => setSetupSharesPending(false),
            }}
          />
        </>
      )}
    </div>
  );
}
