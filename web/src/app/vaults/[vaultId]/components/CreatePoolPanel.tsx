"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import NumericInput from "@/components/form/NumericInput";
import TxActionButton from "@/app/components/TxActionButton";
import { createPoolTxAliased } from "@/lib/tx/amm";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

export default function CreatePoolPanel({
  vaultId,
  vaultSymbol,
  creator,
}: {
  vaultId: string;
  vaultSymbol: string;
  creator: string;
}) {
  const [feeBps, setFeeBps] = useState<string>("30");
  const disabled = !vaultSymbol || !vaultId || Number(feeBps) <= 0;

  const router = useRouter();

  const fcl = useFlowClient();
  const { user: currentUser } = useFlowCurrentUser();

  const userAuth = useMemo(
    () =>
      (
        fcl as unknown as { currentUser(): { authorization: unknown } }
      ).currentUser().authorization,
    [fcl]
  );

  const isCreator =
    currentUser?.addr &&
    creator &&
    currentUser.addr.toLowerCase() === creator.toLowerCase();

  // Prefetch aliased cadence to avoid top-level await in props
  const [cadence, setCadence] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await createPoolTxAliased(vaultId);
        if (!cancelled) setCadence(c);
      } catch {
        if (!cancelled) setCadence(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  if (currentUser && !currentUser.loggedIn) {
    return (
      <NotLoggedIn message="Connect your wallet to create a pool." />
    );
  }

  if (!isCreator) return null;

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="text-sm font-semibold">Create Pool</div>
      <div className="text-xs text-gray-500">
        The account that signs this transaction owns the pool. This does not
        move funds. After creation, liquidity can be added by the creator (seed)
        or by any user via the Liquidity section.
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="vaultSymbol" className="text-gray-500">
            Symbol
          </label>
          <Input
            id="vaultSymbol"
            className="w-32"
            value={vaultSymbol}
            readOnly
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="feeBps" className="text-gray-500">
            Fee (bps)
          </label>
          <NumericInput
            id="feeBps"
            className="w-24"
            value={feeBps}
            onValueChange={setFeeBps}
            decimals={0}
          />
        </div>
        <TxActionButton
          label="Create"
          variant="secondary"
          disabled={disabled || !cadence}
          transaction={
            {
              cadence: cadence as unknown as string,
              args: (
                arg: (v: unknown, t: unknown) => unknown,
                t: Record<string, unknown>
              ) => [
                arg(vaultId, t.String),
                arg(vaultSymbol, t.String),
                arg(String(feeBps), t.UInt64),
              ],
              authorizations: [userAuth],
              limit: 9999,
            } as unknown as never
          }
          mutation={{
            mutationKey: ["create-pool", vaultId, vaultSymbol],
            onSuccess: async () => {
              // Refresh the page data to show the newly created pool
              router.refresh();
            },
            onError: (e: unknown) =>
              console.error("Create pool error", e),
          }}
        />
      </div>
    </div>
  );
}
