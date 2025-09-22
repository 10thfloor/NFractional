"use client";

import { useEffect, useState } from "react";
import { prepareCreateListing } from "@/lib/api/listings";
import type { PreparedTxPayload } from "@/types/listings";

export type ListingFormState = {
  listingId: string;
  priceAsset: string;
  priceAmount: string;
  amount: string;
};

export function usePreparedListing(
  seller: string | undefined,
  vaultId: string,
  form: ListingFormState,
  debounceMs = 350
): { preparedTx: PreparedTxPayload | null; prepareError: string | null } {
  const [preparedTx, setPreparedTx] = useState<PreparedTxPayload | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handle = setTimeout(async () => {
      try {
        setPrepareError(null);
        if (!seller) {
          console.log("loading prepared listing 3");
          setPreparedTx(null);
          return;
        }
        const { listingId, priceAsset, priceAmount, amount } = form;

        if (!(listingId && priceAsset && priceAmount && amount)) {
          setPreparedTx(null);
          return;
        }
        const payload = await prepareCreateListing({
          seller,
          vaultId,
          listingId,
          priceAsset: priceAsset || "FLOW",
          priceAmount: priceAmount || "0.0",
          amount: amount || "0.0",
        });
        if (!cancelled) setPreparedTx(payload);
      } catch (e) {
        if (!cancelled) {
          setPreparedTx(null);
          setPrepareError((e as Error).message);
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    seller,
    vaultId,
    form,
    form.listingId,
    form.priceAsset,
    form.priceAmount,
    form.amount,
    debounceMs,
  ]);

  return { preparedTx, prepareError };
}
