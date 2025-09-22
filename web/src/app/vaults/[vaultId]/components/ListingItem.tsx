"use client";

import type { Listing } from "@/types/listings";
import TxActionButton from "@/app/components/TxActionButton";
import { useState } from "react";
import { cancelListingTx } from "@/lib/tx/listings";
import type { CadenceAddrsStd } from "@/lib/flow";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import { useFlowClient } from "@onflow/react-sdk";
import { useVaultCustodyStatus } from "@/hooks/useVaultCustodyStatus";
import BuyButton from "@/app/listings/components/BuyButton";

export default function ListingItem({
  listing,
  vaultId,
  vaultSymbol,
  addrs,
  userAuth,
  adminAuth,
  disabled,
  onSuccess,
  onError,
}: {
  listing: Listing;
  vaultId: string;
  vaultSymbol: string;
  addrs: unknown;
  userAuth: unknown;
  adminAuth: unknown;
  disabled?: boolean;
  onSuccess?: (txId: string) => void;
  onError?: (e: unknown) => void;
}) {
  const { user } = useFlowCurrentUser();
  const fcl = useFlowClient();
  const custody = useVaultCustodyStatus(vaultId, fcl);
  const canCancel =
    (listing.status || "").toLowerCase() === "open" && Boolean(listing.seller);
  const canBuy = (listing.status || "").toLowerCase() === "open";

  const isOpen = String(listing.status || "").toLowerCase() === "open";

  const isListingOwner =
    (user?.addr?.toLowerCase() || "") === (listing.seller?.toLowerCase() || "");

  const showCancel = isListingOwner && canCancel;
  const showBuy = !isListingOwner && canBuy;

  const [cancelPending, setCancelPending] = useState(false);

  const stdAddrs = addrs as Pick<
    CadenceAddrsStd,
    "ft" | "flow" | "fractional" | "ftcon" | "swapcon" | "swapcfg"
  >;

  // UI helpers
  const priceNum = Number(String(listing.priceAmount || "0"));
  const amountNum = Number(String(listing.amount || "0"));
  const totalNum = amountNum && priceNum ? amountNum * priceNum : 0;
  const sellerFull = String(listing.seller || "");
  const sellerShort = `${sellerFull.replace(/^0x/, "0x").slice(0, 10)}…`;

  return (
    <div
      className={`rounded-md border p-3 space-y-2 mb-2 ${
        isOpen
          ? "border-emerald-800/40 bg-emerald-950/20"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="flex items-start md:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            Listing
          </div>
          <div className="font-mono text-sm text-neutral-100 truncate">
            #{listing.listingId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] px-2 py-0.5 rounded border ${
              isOpen
                ? "border-emerald-700 text-emerald-300 bg-emerald-900/20"
                : "border-neutral-700 text-neutral-300"
            }`}
          >
            {String(listing.status || "").toUpperCase()}
          </span>
          <span className="text-[11px] text-neutral-500 hidden md:inline">
            {listing.createdAt}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <div className="text-xs text-neutral-300">
          <div className="flex gap-2 items-center">
            <span className="text-neutral-400">Seller</span>
            <span
              className="font-mono text-neutral-200"
              title={listing.seller || ""}
            >
              {sellerShort}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-neutral-400">Amount</span>{" "}
            <span className="text-neutral-100">
              {amountNum.toLocaleString()} {vaultSymbol}
            </span>
          </div>
        </div>

        <div className="text-xs text-neutral-300">
          <div>
            <span className="text-neutral-400">Price</span>{" "}
            <span className="text-neutral-100">
              {priceNum.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
              {listing.priceAsset}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-neutral-400">Total</span>{" "}
            <span className="text-neutral-100">
              {totalNum.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
              {listing.priceAsset}
            </span>
          </div>
        </div>

        <div className="flex md:justify-end gap-2">
          {showCancel && (
            <TxActionButton
              id={`cancel-listing-${listing.listingId}`}
              type="button"
              label={cancelPending ? "Cancelling…" : "Cancel"}
              variant="secondary"
              disabled={disabled || cancelPending}
              transaction={{
                cadence: cancelListingTx(stdAddrs),
                args: (arg, t) => [
                  arg(vaultSymbol, t.String),
                  arg(vaultId, t.String),
                  arg(listing.listingId, t.String),
                  arg((listing.seller as string) || "0x0", t.Address),
                  arg(listing.amount || "0.0", t.UFix64),
                ],
                authorizations: [
                  userAuth as unknown as never,
                  adminAuth as unknown as never,
                ],
                limit: 9999,
              }}
              mutation={{
                mutationKey: ["cancel", vaultId, listing.listingId],
                onMutate: () => setCancelPending(true),
                onSuccess: async (txId: string) => {
                  try {
                    onSuccess?.(txId);
                  } catch (e) {
                    onError?.(e);
                  }
                },
                onError: (e: unknown) => onError?.(e),
                onSettled: () => setCancelPending(false),
              }}
            />
          )}
          {showBuy && (
            <BuyButton
              vaultId={vaultId}
              symbol={vaultSymbol}
              listingId={String(listing.listingId)}
              seller={String(listing.seller || "0x0")}
              priceAmount={String(listing.priceAmount || "0.0")}
              shareAmount={String(listing.amount || "0.0")}
            />
          )}
        </div>
      </div>
      {!custody.loading && !custody.alive && showBuy ? (
        <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded">
          Vault custody is offline. Buying is temporarily disabled until custody
          is restored.
        </div>
      ) : null}
    </div>
  );
}
