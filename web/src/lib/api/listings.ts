import type {
  Listing,
  PreparedTxPayload,
  ShareTokenMeta,
} from "@/types/listings";

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
}

export async function fetchListings(vaultId: string): Promise<Listing[]> {
  const query = `
    query Listings($network: String!, $vaultId: String!, $limit: Int!) {
      listings(network: $network, vaultId: $vaultId, limit: $limit) {
        network vaultId listingId seller priceAsset priceAmount amount status createdAt
      }
    }
  `;
  // Keep using existing gqlFetch to benefit from configured defaults
  const { gqlFetch, DEFAULT_NETWORK } = await import("@/lib/graphql");
  const data = await gqlFetch<{ listings: Listing[] }>(query, {
    network: DEFAULT_NETWORK,
    vaultId,
    limit: 50,
  });
  return data.listings || [];
}

export async function prepareCreateListing(input: {
  seller: string;
  vaultId: string;
  listingId: string;
  priceAsset: string;
  priceAmount: string;
  amount: string;
}): Promise<PreparedTxPayload> {
  const API = getApiBase();
  const res = await fetch(`${API}/listings/create-safe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).catch((e) => {
    console.log("error", e);
    throw e;
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || "listing prepare failed");
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.cadence) {
    throw new Error("listing prepare missing cadence");
  }
  return payload as PreparedTxPayload;
}

export async function fetchVaultFTMeta(
  vaultId: string
): Promise<ShareTokenMeta | null> {
  const API = getApiBase();
  const res = await fetch(`${API}/vaults/${vaultId}/ft`);
  if (!res.ok) {
    return null;
  }
  const data = await res.json();

  const ft = data?.ft as { address?: string; name?: string } | undefined;
  const meta = data?.meta as
    | {
        name?: string;
        symbol?: string;
        decimals?: string;
        totalSupply?: string;
        maxSupply?: string;
        contractName?: string;
      }
    | undefined;

  if (!ft?.address) return null;

  return {
    name: String(meta?.name || ft.name || ""),
    symbol: String(meta?.symbol || ""),
    address: String(ft.address),
    decimals: Number(meta?.decimals ?? 8),
    totalSupply: meta?.totalSupply,
    maxSupply: meta?.maxSupply ?? null,
    contractName: String(ft.name),
  };
}

export async function fetchAdminInfo(): Promise<{
  addr: string;
  keyId: number;
} | null> {
  const API = getApiBase();
  try {
    const res = await fetch(`${API}/flow/admin-info`);
    if (!res.ok) return null;
    const info = await res.json();
    return {
      addr: String(info.addr || "0x0"),
      keyId: Number(info.keyId || 0),
    };
  } catch {
    return null;
  }
}
