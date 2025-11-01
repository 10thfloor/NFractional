"use client";

// Using Flow SDK hooks
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { useMemo, useState } from "react";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import { useListings } from "@/hooks/useListings";
import {
  usePreparedListing,
  type ListingFormState,
} from "@/hooks/usePreparedListing";
import { waitForTransactionSealed } from "@/lib/tx/utils";
import Messages from "./components/Messages";
import ListingForm from "./components/ListingForm";
import ListingsList from "./components/ListingsList";

export default function ListingsPanel({
  vaultId,
  vaultSymbol,
  creator,
}: {
  vaultId: string;
  vaultSymbol: string;
  creator: string;
  custodyReady?: boolean;
  maxSupply?: string | null;
  escrowBalance?: string | null;
}) {
  const fcl = useFlowClient();

  const { user } = useFlowCurrentUser();
  const flowAddrs = useFlowAddresses();

  const { adminAuth, adminReady } = useAdminInfo();
  const { listings, reload, error } = useListings(vaultId);

  const userAuth = useMemo(
    () =>
      (
        fcl as unknown as { currentUser(): { authorization: unknown } }
      ).currentUser().authorization,
    [fcl]
  );

  const userReady = Boolean(user?.addr);
  const isCreator = useMemo(() => {
    if (!user?.addr || !creator) return false;
    return user.addr.toLowerCase() === creator.toLowerCase();
  }, [user?.addr, creator]);

  const [form, setForm] = useState<ListingFormState>({
    listingId: "",
    priceAsset: "FLOW",
    priceAmount: "",
    amount: "",
  });

  const { preparedTx, prepareError } = usePreparedListing(
    user?.addr,
    vaultId,
    form,
    350
  );

  const canSubmit = useMemo(() => {
    // Check if form fields are valid immediately (without waiting for preparedTx)
    const formValid =
      Boolean(form.listingId?.trim()) &&
      Boolean(form.priceAsset?.trim()) &&
      Number(form.amount) > 0 &&
      Number(form.priceAmount) > 0;

    // Still require preparedTx to be ready for actual submission
    return (
      Boolean(preparedTx?.cadence) &&
      Boolean(adminReady && userReady) &&
      formValid
    );
  }, [
    preparedTx?.cadence,
    adminReady,
    userReady,
    form.listingId,
    form.priceAsset,
    form.amount,
    form.priceAmount,
  ]);

  const [success, setSuccess] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <h3 id="create-listing" className="font-medium">
        Create a Listing
      </h3>
      <Messages error={error || prepareError || localError} success={success} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ListingForm
            form={form}
            setForm={setForm}
            preparedTx={preparedTx}
            canSubmit={canSubmit}
            userAuth={userAuth}
            adminAuth={adminAuth}
            vaultSymbol={vaultSymbol}
            onSuccess={async (txId: string) => {
              try {
                // Wait for transaction to be sealed via websocket
                await waitForTransactionSealed(fcl, txId);
                // Reload listings to show the new listing
                await reload();
                setSuccess("Listing created successfully!");
                setForm({
                  listingId: "",
                  priceAsset: "FLOW",
                  priceAmount: "",
                  amount: "",
                });
              } catch (e) {
                setLocalError(
                  `Transaction failed: ${(e as Error).message || String(e)}`
                );
                console.error("ListingForm onSuccess error", e);
              }
            }}
            onError={(e: unknown) => {
              setLocalError((e as Error).message);
              console.error("ListingForm onError", e);
            }}
          />
        </div>
        <div className="md:sticky md:top-2 space-y-2">
          {/* <div className="text-sm font-medium text-neutral-200">
            Active Listings
          </div> */}
          <div className="divide-y">
            <ListingsList
              listings={listings}
              vaultId={vaultId}
              vaultSymbol={vaultSymbol}
              addrs={flowAddrs as unknown as Record<string, unknown>}
              userAuth={userAuth}
              adminAuth={adminAuth}
              disabled={!adminReady}
              isCreator={isCreator}
              onSuccess={async (txId: string) => {
                try {
                  // Wait for transaction to be sealed via websocket
                  await waitForTransactionSealed(fcl, txId);
                  // Reload listings to reflect the change
                  await reload();
                  setSuccess("Transaction completed successfully!");
                } catch (e) {
                  setLocalError(
                    `Transaction failed: ${(e as Error).message || String(e)}`
                  );
                  console.error("ListingsList onSuccess error", e);
                }
              }}
              onError={(e: unknown) => {
                console.error("ListingsList onError", e);
                setLocalError((e as Error).message);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
