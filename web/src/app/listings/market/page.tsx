"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/app/components/PageContainer";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import BuyButton from "@/app/listings/components/BuyButton";

type MarketRow = {
  vaultId: string;
  listingId: string;
  seller?: string | null;
  priceAsset?: string | null;
  priceAmount?: string | null;
  amount?: string | null;
  status?: string | null;
  vaultSymbol?: string | null;
};

export default function ListingsMarketPage() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = `
          query Q($network: String!, $limit: Int!, $offset: Int) {
            marketplaceListings(network: $network, limit: $limit, offset: $offset) {
              listings { vaultId listingId seller priceAsset priceAmount amount status vaultSymbol }
              totalCount hasMore
            }
          }
        `;
        const r = await gqlFetch<{
          marketplaceListings: { listings: MarketRow[] };
        }>(q, { network: DEFAULT_NETWORK, limit: 50, offset: 0 });
        setRows(r.marketplaceListings?.listings || []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="divide-y border rounded mt-3">
        {!loading && rows.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No listings open.</div>
        ) : null}
        {rows.map((r) => (
          <div
            key={`${r.vaultId}-${r.listingId}`}
            className="p-3 flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex-1">
              <div className="font-medium">{r.listingId}</div>
              <div className="text-gray-600">
                {r.vaultSymbol} • {r.vaultId} • {r.amount} for {r.priceAmount}{" "}
                {r.priceAsset}
              </div>
            </div>
            <BuyButton
              vaultId={r.vaultId}
              symbol={String(r.vaultSymbol || "")}
              listingId={r.listingId}
              seller={String(r.seller || "")}
              priceAmount={String(r.priceAmount || "0.0")}
              shareAmount={String(r.amount || "0.0")}
            />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
