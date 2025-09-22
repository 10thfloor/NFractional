"use client";

import ListingItem from "@/app/vaults/[vaultId]/components/ListingItem";
import type { Listing } from "@/types/listings";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import { useFlowAddresses } from "@/app/FlowAddressesContext";
import { useFlowClient } from "@onflow/react-sdk";

type MarketplaceListing = Listing & {
  vaultSymbol: string;
  vaultName: string;
};

export default function MarketplaceListingCard({
  listing,
}: {
  listing: MarketplaceListing;
}) {
  const fcl = useFlowClient();
  const { adminAuth } = useAdminInfo();
  const addrs = useFlowAddresses();

  // For marketplace, vaultId and symbol come from the listing payload
  const vaultId = String(listing.vaultId);
  const vaultSymbol = String(listing.vaultSymbol);

  // Forward to the standardized ListingItem UI
  return (
    <ListingItem
      listing={listing}
      vaultId={vaultId}
      vaultSymbol={vaultSymbol}
      addrs={addrs as unknown}
      userAuth={
        (
          fcl as unknown as { currentUser(): { authorization: unknown } }
        ).currentUser().authorization
      }
      adminAuth={adminAuth as unknown}
      disabled={false}
    />
  );
}
