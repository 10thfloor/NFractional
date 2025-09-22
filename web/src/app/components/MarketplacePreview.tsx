import Link from "next/link";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import dynamic from "next/dynamic";
const MarketplaceListingCard = dynamic(
  () => import("@/app/marketplace/components/MarketplaceListingCard"),
  { ssr: false }
);

type MarketplaceListing = {
  network: string;
  vaultId: string;
  listingId: string;
  seller: string;
  priceAsset: string;
  priceAmount: string;
  amount: string;
  status: string;
  createdAt: string;
  vaultSymbol: string;
  vaultName: string;
};

type MarketplaceStats = {
  totalListings: number;
  openListings: number;
  totalVolume: string;
  uniqueAssets: number;
  uniqueVaults: number;
};

type MarketplacePreviewData = {
  marketplaceListings: {
    listings: MarketplaceListing[];
    totalCount: number;
    hasMore: boolean;
  };
  marketplaceStats: MarketplaceStats;
};

export default async function MarketplacePreview() {
  const query = `
    query MarketplacePreview($network: String!) {
      marketplaceListings(network: $network, limit: 3, sortBy: CREATED_AT_DESC) {
        listings {
          network
          vaultId
          listingId
          seller
          priceAsset
          priceAmount
          amount
          status
          createdAt
          vaultSymbol
          vaultName
        }
        totalCount
        hasMore
      }
      marketplaceStats(network: $network) {
        totalListings
        openListings
        totalVolume
        uniqueAssets
        uniqueVaults
      }
    }
  `;

  const data = await gqlFetch<MarketplacePreviewData>(query, {
    network: DEFAULT_NETWORK,
  });

  const { marketplaceListings, marketplaceStats } = data;

  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3 text-neutral-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-100">
          Marketplace
        </h2>
        <Link
          href="/marketplace"
          className="text-xs text-neutral-300 hover:text-neutral-100"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-neutral-950 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {marketplaceStats.openListings}
          </div>
          <div className="text-[11px] text-neutral-400">Open Listings</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {marketplaceStats.totalVolume}
          </div>
          <div className="text-[11px] text-neutral-400">Total Volume</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {marketplaceStats.uniqueVaults}
          </div>
          <div className="text-[11px] text-neutral-400">Vaults</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {marketplaceStats.uniqueAssets}
          </div>
          <div className="text-[11px] text-neutral-400">Assets</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2 rounded text-center">
          <div className="text-lg font-semibold text-neutral-100">
            {marketplaceStats.totalListings}
          </div>
          <div className="text-[11px] text-neutral-400">Total</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-200">
          Recent Listings
        </div>
        {marketplaceListings.listings.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-sm">
            No listings yet. Be the first to list shares!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {marketplaceListings.listings.map((listing) => (
              <MarketplaceListingCard
                key={listing.listingId}
                listing={listing}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
