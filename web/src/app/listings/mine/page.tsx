"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import PageContainer from "@/app/components/PageContainer";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

type Listing = {
  network: string;
  vaultId: string;
  listingId: string;
  seller?: string | null;
  priceAsset?: string | null;
  priceAmount?: string | null;
  amount?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

type ListingsBySellerResponse = { listingsBySeller: Listing[] };
type AccountShareBalance = { vaultId: string; symbol: string; amount: string };

export default function MyListingsPage() {
  const { user } = useFlowCurrentUser();
  const [account, setAccount] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [balances, setBalances] = useState<AccountShareBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUser = (user?.addr || "").trim();
    const fromStorage = (
      window.localStorage.getItem("flow.defaultAccount") || ""
    ).trim();
    const raw = fromUser || fromStorage;
    const normalized = raw ? (raw.startsWith("0x") ? raw : `0x${raw}`) : "";
    setAccount(normalized);
  }, [user?.addr]);

  useEffect(() => {
    async function load() {
      if (!account) return;
      setLoading(true);
      setError(null);
      try {
        const query = `
          query ListingsBySeller($network: String!, $seller: String!, $limit: Int!) {
            listingsBySeller(network: $network, seller: $seller, limit: $limit) {
              network vaultId listingId seller priceAsset priceAmount amount status createdAt
            }
          }
        `;
        const data = await gqlFetch<ListingsBySellerResponse>(query, {
          network: DEFAULT_NETWORK,
          seller: account,
          limit: 100,
        });
        const base = data.listingsBySeller || [];
        // Refresh each listing's status from authoritative table to avoid stale status in listings_by_seller
        const refreshed = await Promise.all(
          base.map(async (l) => {
            try {
              const one = await gqlFetch<{ listing: Listing }>(
                "query One($network: String!, $vaultId: String!, $listingId: String!) { listing(network: $network, vaultId: $vaultId, listingId: $listingId) { network vaultId listingId seller priceAsset priceAmount amount status createdAt } }",
                {
                  network: DEFAULT_NETWORK,
                  vaultId: l.vaultId,
                  listingId: l.listingId,
                }
              );
              return one.listing ?? l;
            } catch {
              return l;
            }
          })
        );
        setListings(refreshed);

        // Fetch all vaults and compute per-vault share balance for this account
        const vaultsQuery = `
          query Vaults($network: String!, $limit: Int!) {
            vaults(network: $network, limit: $limit) {
              vaultId
              shareSymbol
            }
          }
        `;
        const vaultsResp = await gqlFetch<{
          vaults: { vaultId: string; shareSymbol: string | null }[];
        }>(vaultsQuery, {
          network: DEFAULT_NETWORK,
          limit: 200,
        });
        const vaults = (vaultsResp.vaults || []).filter((v) => v.shareSymbol);
        const shareBalanceQuery = `
          query ShareBalance($network: String!, $vaultId: String!, $account: String!) {
            shareBalance(network: $network, vaultId: $vaultId, account: $account) {
              balance
            }
          }
        `;
        const results = await Promise.all(
          vaults.map(async (v) => {
            try {
              const r = await gqlFetch<{ shareBalance: { balance: string } }>(
                shareBalanceQuery,
                {
                  network: DEFAULT_NETWORK,
                  vaultId: v.vaultId,
                  account,
                }
              );
              const amt = r.shareBalance?.balance || "0.0";
              return {
                vaultId: v.vaultId,
                symbol: v.shareSymbol as string,
                amount: amt,
              } as AccountShareBalance;
            } catch {
              return {
                vaultId: v.vaultId,
                symbol: v.shareSymbol as string,
                amount: "0.0",
              } as AccountShareBalance;
            }
          })
        );
        setBalances(results.filter((b) => Number(b.amount) > 0));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [account]);

  const hasListings = useMemo(
    () => listings && listings.length > 0,
    [listings]
  );

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">My Shares & Listings</h1>
      {user && !user.loggedIn && (
        <div className="mt-4">
          <NotLoggedIn message="Connect your wallet to view your shares and listings." />
        </div>
      )}
      {user?.loggedIn && (
        <>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <section className="space-y-2">
            <div className="text-sm text-gray-700 font-medium">
              Your Share Balances
            </div>
            <p className="text-xs text-gray-500">
              These are your current balances of vault share tokens. Balances update
              after transactions are indexed.
            </p>
            <div className="divide-y border rounded">
              {!loading && balances.length === 0 && (
                <div className="p-3 text-sm text-gray-600">
                  You don&apos;t hold any shares yet.
                </div>
              )}
              {balances.map((b, i) => (
                <div
                  key={`${b.symbol}-${i}`}
                  className="p-3 text-sm flex justify-between"
                >
                  <div className="text-gray-700">
                    {b.symbol}
                    <span className="ml-2 text-gray-400">• {b.vaultId}</span>
                  </div>
                  <div className="text-gray-100">{b.amount}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <div className="text-sm text-gray-700 font-medium">
              Your Listings (created by you)
            </div>
            <div className="divide-y border rounded">
              {!loading && !hasListings && (
                <div className="p-3 text-sm text-gray-600">
                  You haven&apos;t created any listings yet.
                </div>
              )}
              {listings.map((l) => (
                <div key={l.listingId} className="p-3 text-sm">
                  <div className="font-medium">{l.listingId}</div>
                  <div className="text-gray-600">
                    Vault {l.vaultId} • {l.amount} @ {l.priceAmount} {l.priceAsset}{" "}
                    • {l.status}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
