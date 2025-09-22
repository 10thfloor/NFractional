"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import Link from "next/link";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import MarketplaceListingCard from "@/app/marketplace/components/MarketplaceListingCard";
import MarketplaceFilters from "./components/MarketplaceFilters";
import PageContainer from "@/app/components/PageContainer";

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
  openVolume: string;
  uniqueAssets: number;
  uniqueVaults: number;
};

type MarketplaceListingsResponse = {
  listings: MarketplaceListing[];
  totalCount: number;
  hasMore: boolean;
};

type MarketplaceData = {
  marketplaceListings: MarketplaceListingsResponse;
  marketplaceStats: MarketplaceStats;
};

type Filters = {
  sortBy: string;
  filterByAsset: string;
  filterByStatus: string;
};

export default function MarketplacePage() {
  const { user } = useFlowCurrentUser();
  const [data, setData] = useState<MarketplaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    sortBy: "CREATED_AT_DESC",
    filterByAsset: "",
    filterByStatus: "OPEN",
  });

  const fetchMarketplaceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = `
        query Marketplace($network: String!, $limit: Int!, $offset: Int!, $sortBy: MarketplaceSortBy!, $filterByAsset: String, $filterByStatus: ListingStatus) {
          marketplaceListings(network: $network, limit: $limit, offset: $offset, sortBy: $sortBy, filterByAsset: $filterByAsset, filterByStatus: $filterByStatus) {
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
            openVolume
            uniqueAssets
            uniqueVaults
          }
        }
      `;

      const result = await gqlFetch<MarketplaceData>(query, {
        network: DEFAULT_NETWORK,
        limit: 20,
        offset: 0,
        sortBy: filters.sortBy,
        filterByAsset: filters.filterByAsset || undefined,
        filterByStatus: filters.filterByStatus || undefined,
      });

      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters.sortBy, filters.filterByAsset, filters.filterByStatus]);

  useEffect(() => {
    fetchMarketplaceData();
  }, [fetchMarketplaceData]);

  const handleFiltersChange = (newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {["a", "b", "c", "d", "e"].map((k) => (
              <div key={`stat-${k}`} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["a", "b", "c", "d", "e", "f"].map((k) => (
              <div key={`card-${k}`} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-4">Marketplace</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchMarketplaceData} type="button">
            Try Again
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!data) return null;

  const { marketplaceListings, marketplaceStats } = data;

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Marketplace</h1>
        <div className="text-xs text-neutral-300">
          {user?.addr ? (
            <span>Welcome, {user.addr}</span>
          ) : (
            <span>Connect wallet to trade</span>
          )}
        </div>
      </div>

      {/* Stats Cards (compact) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-md text-center">
          <div className="text-lg font-bold text-neutral-100">
            {marketplaceStats.openListings}
          </div>
          <div className="text-[11px] text-neutral-400">Open Listings</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-md text-center">
          <div className="text-lg font-bold text-neutral-100">
            {marketplaceStats.openVolume}
          </div>
          <div className="text-[11px] text-neutral-400">Open Volume</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-md text-center">
          <div className="text-lg font-bold text-neutral-100">
            {marketplaceStats.uniqueVaults}
          </div>
          <div className="text-[11px] text-neutral-400">Active Vaults</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-md text-center">
          <div className="text-lg font-bold text-neutral-100">
            {marketplaceStats.uniqueAssets}
          </div>
          <div className="text-[11px] text-neutral-400">Trading Assets</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-md text-center">
          <div className="text-lg font-bold text-neutral-100">
            {marketplaceStats.totalListings}
          </div>
          <div className="text-[11px] text-neutral-400">Total Listings</div>
        </div>
      </div>

      {/* Filters */}
      <MarketplaceFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Listings Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-neutral-100">
            {filters.filterByStatus === "OPEN" ? "Active" : "All"} Listings
          </h2>
          <div className="text-xs text-neutral-300">
            {marketplaceListings.totalCount} total listings
          </div>
        </div>

        {marketplaceListings.listings.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-md">
            <p className="text-neutral-400 mb-4">
              No listings found with current filters.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/wizard/deposit">Fractionalize Your NFT</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {marketplaceListings.listings.map((listing) => (
              <MarketplaceListingCard
                key={listing.listingId + listing.seller}
                listing={listing}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
