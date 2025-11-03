"use client";

import { useState, useEffect } from "react";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import TxActionButton from "@/app/components/TxActionButton";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { payListingTxAliased } from "@/lib/tx/listings";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import { formatUFix64 } from "@/lib/num";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import NotLoggedIn from "@/components/ui/NotLoggedIn";
import type { FclArgFn, FclType } from "@/lib/types/fcl";
import { useTreasuryReady } from "@/hooks/useTreasuryReady";

export default function BuyButton({
  vaultId,
  symbol,
  listingId,
  seller,
  priceAmount,
  shareAmount,
}: {
  vaultId: string;
  symbol: string;
  listingId: string;
  seller: string;
  priceAmount: string;
  shareAmount: string;
}) {
  const { user } = useFlowCurrentUser();
  const fcl = useFlowClient();
  const addrs = useFlowAddresses();
  const custody = useVaultCustodyStatus(vaultId, fcl);
  const { ready: treasuryReady, setReady: setTreasuryReady } =
    useTreasuryReady(vaultId);

  const [cadence, setCadence] = useState<string>("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await payListingTxAliased();
        if (!cancelled) setCadence(c);
      } catch {
        if (!cancelled) setCadence("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user && !user.loggedIn) {
    return <NotLoggedIn message="Connect your wallet to buy shares." />;
  }
  const disabled = !cadence || custody.loading || !custody.alive;

  return (
    <TxActionButton
      label={pending ? "Buying…" : "Buy"}
      variant="secondary"
      disabled={disabled || pending}
      beforeExecute={async () => {
        if (treasuryReady) return;
        const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        await fetch(`${API}/pools/ensure-ready`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vaultId }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          setTreasuryReady(true);
        });
      }}
      transaction={
        {
          cadence,
          args: (arg: FclArgFn, t: FclType) => {
            const types = t as {
              String: unknown;
              Address: unknown;
              UFix64: unknown;
            };
            return [
              arg(vaultId, types.String),
              arg(listingId, types.String),
              arg(seller, types.Address),
              arg(priceAmount, types.UFix64),
              arg(addrs.platformAdmin, types.Address),
            ];
          },
          limit: 9999,
        } as unknown as never
      }
      mutation={{
        mutationKey: ["buy-listing", listingId],
        onSuccess: async () => {
          // Request server to settle and transfer shares, then refresh UI
          const m = `
              mutation BuyListing(
                $network: String!,
                $vaultId: String!,
                $listingId: String!,
                $buyer: String!,
                $symbol: String!,
                $shareAmount: String!,
                $priceAmount: String!,
                $seller: String!
              ) {
                settleListing(
                  network: $network,
                  vaultId: $vaultId,
                  listingId: $listingId,
                  buyer: $buyer,
                  symbol: $symbol,
                  shareAmount: $shareAmount,
                  priceAmount: $priceAmount,
                  seller: $seller
                ) { txId }
              }
            `;
          try {
            await gqlFetch(m, {
              network: DEFAULT_NETWORK,
              vaultId,
              listingId,
              buyer: user?.addr ?? "",
              symbol,
              shareAmount: formatUFix64(shareAmount),
              priceAmount: formatUFix64(priceAmount),
              seller,
            });
          } catch (e) {
            console.error("settleListing failed", e);
          } finally {
            try {
              window.location.reload();
            } catch {}
          }
        },
        onSettled: () => setPending(false),
      }}
    />
  );
}
