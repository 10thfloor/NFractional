"use client";

import type { Listing } from "@/types/listings";
import ListingItem from "./ListingItem";

export default function ListingsList({
  listings,
  vaultId,
  vaultSymbol,
  addrs,
  userAuth,
  adminAuth,
  disabled,
  onSuccess,
  onError,
}: {
  listings: Listing[];
  vaultId: string;
  vaultSymbol: string;
  addrs: unknown;
  userAuth: unknown;
  adminAuth: unknown;
  disabled?: boolean;
  isCreator?: boolean;
  onSuccess?: (txId: string) => void;
  onError?: (e: unknown) => void;
}) {
  const hasListings = listings.length > 0;
  return (
    <div className="divide-y">
      {!hasListings && (
        <div className="p-3 text-sm text-gray-600">No listings yet.</div>
      )}
      {listings.map((l) => (
        <ListingItem
          key={l.listingId}
          listing={l}
          vaultId={vaultId}
          vaultSymbol={vaultSymbol}
          addrs={addrs}
          userAuth={userAuth}
          adminAuth={adminAuth}
          disabled={disabled}
          onSuccess={onSuccess}
          onError={onError}
        />
      ))}
    </div>
  );
}
