import type { Client as Cassandra } from "cassandra-driver";

export async function listListings(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; limit: number }
) {
  const q =
    "SELECT network, vault_id, listing_id, seller, price_asset, price_amount, amount, status, created_at FROM fractional.listings WHERE network=? AND vault_id=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    listingId: row.get("listing_id"),
    seller: row.get("seller"),
    priceAsset: row.get("price_asset"),
    priceAmount: row.get("price_amount"),
    amount: row.get("amount"),
    status: row.get("status"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function listListingsBySeller(
  cassandra: Cassandra,
  params: { network: string; seller: string; limit: number }
) {
  const q =
    "SELECT network, seller, listing_id, vault_id, price_asset, price_amount, amount, status, created_at FROM fractional.listings_by_seller WHERE network=? AND seller=? LIMIT ?";
  const r = await cassandra.execute(
    q,
    [params.network, params.seller, params.limit],
    {
      prepare: true,
    }
  );
  return r.rows.map((row) => ({
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    listingId: row.get("listing_id"),
    seller: row.get("seller"),
    priceAsset: row.get("price_asset"),
    priceAmount: row.get("price_amount"),
    amount: row.get("amount"),
    status: row.get("status"),
    createdAt: row.get("created_at")?.toISOString?.(),
  }));
}

export async function getListing(
  cassandra: Cassandra,
  params: { network: string; vaultId: string; listingId: string }
) {
  const q =
    "SELECT network, vault_id, listing_id, seller, price_asset, price_amount, amount, status, created_at FROM fractional.listings WHERE network=? AND vault_id=? AND listing_id=? LIMIT 1";
  const r = await cassandra.execute(
    q,
    [params.network, params.vaultId, params.listingId],
    { prepare: true }
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    network: row.get("network"),
    vaultId: row.get("vault_id"),
    listingId: row.get("listing_id"),
    seller: row.get("seller") as string,
    priceAsset: row.get("price_asset") as string,
    priceAmount: row.get("price_amount") as string,
    amount: row.get("amount") as string,
    status: row.get("status") as string,
    createdAt: row.get("created_at")?.toISOString?.(),
  };
}

export async function getMarketplaceListings(
  cassandra: Cassandra,
  params: {
    network: string;
    limit: number;
    offset: number; // currently unused; Cassandra has no OFFSET. Reserved for future cursor paging.
    sortBy: string;
    filterByAsset?: string;
    filterByStatus?: string;
  }
) {
  // Cassandra/Scylla does not support JOIN or OFFSET. Implement pragmatic approach:
  // 1) Fetch listings by network with ALLOW FILTERING (small dev datasets)
  // 2) Filter and sort in application
  // 3) Enrich with vault metadata via follow-up queries

  const baseQ =
    "SELECT network, vault_id, listing_id, seller, price_asset, price_amount, amount, status, created_at FROM fractional.listings WHERE network=? ALLOW FILTERING";
  const baseR = await cassandra.execute(baseQ, [params.network], {
    prepare: true,
  });
  let listings = baseR.rows.map((row) => ({
    network: row.get("network") as string,
    vaultId: row.get("vault_id") as string,
    listingId: row.get("listing_id") as string,
    seller: row.get("seller") as string,
    priceAsset: (row.get("price_asset") as string) || "",
    priceAmount: (row.get("price_amount") as string) || "0",
    amount: (row.get("amount") as string) || "0",
    status: (row.get("status") as string) || "open",
    createdAt:
      (row.get("created_at") as Date | undefined)?.toISOString?.() || "",
  }));

  // Apply filters
  if (params.filterByAsset) {
    const asset = params.filterByAsset.toUpperCase();
    listings = listings.filter(
      (l) => (l.priceAsset || "").toUpperCase() === asset
    );
  }
  if (params.filterByStatus) {
    const st = params.filterByStatus.toLowerCase();
    listings = listings.filter((l) => (l.status || "").toLowerCase() === st);
  }

  // Sort in-memory
  switch (params.sortBy) {
    case "CREATED_AT_ASC":
      listings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "PRICE_AMOUNT_DESC":
      listings.sort((a, b) => Number(b.priceAmount) - Number(a.priceAmount));
      break;
    case "PRICE_AMOUNT_ASC":
      listings.sort((a, b) => Number(a.priceAmount) - Number(b.priceAmount));
      break;
    case "AMOUNT_DESC":
      listings.sort((a, b) => Number(b.amount) - Number(a.amount));
      break;
    case "AMOUNT_ASC":
      listings.sort((a, b) => Number(a.amount) - Number(b.amount));
      break;
    default:
      // CREATED_AT_DESC
      listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const totalCount = listings.length;
  const pageListings = listings.slice(0, params.limit);

  // Enrich with vault metadata
  const uniqueVaultIds = Array.from(
    new Set(pageListings.map((l) => l.vaultId))
  );
  const vaultMetaMap = new Map<
    string,
    { share_symbol: string; collection: string }
  >();
  for (const vid of uniqueVaultIds) {
    const r = await cassandra.execute(
      "SELECT share_symbol, collection FROM fractional.vaults WHERE network=? AND vault_id=?",
      [params.network, vid],
      { prepare: true }
    );
    const row = r.first();
    if (row) {
      vaultMetaMap.set(vid, {
        share_symbol: row.get("share_symbol") as string,
        collection: row.get("collection") as string,
      });
    }
  }

  const enriched = pageListings.map((l) => {
    const meta = vaultMetaMap.get(l.vaultId);
    return {
      ...l,
      vaultSymbol: meta?.share_symbol || null,
      vaultName: meta?.collection || null,
    };
  });

  return {
    listings: enriched,
    totalCount,
    hasMore: totalCount > params.limit,
  };
}

export async function getMarketplaceStats(
  cassandra: Cassandra,
  params: { network: string }
) {
  // Get total listings count
  const totalListingsQuery = `
    SELECT COUNT(*) as total FROM fractional.listings WHERE network = ? ALLOW FILTERING
  `;
  const totalR = await cassandra.execute(totalListingsQuery, [params.network], {
    prepare: true,
  });
  const totalListings = totalR.rows[0]?.get("total") || 0;

  // Get open listings count
  const openListingsQuery = `
    SELECT COUNT(*) as open FROM fractional.listings WHERE network = ? AND status = 'open' ALLOW FILTERING
  `;
  const openR = await cassandra.execute(openListingsQuery, [params.network], {
    prepare: true,
  });
  const openListings = openR.rows[0]?.get("open") || 0;

  // Get unique assets (scan + dedupe for dev; replace with MV later)
  const assetsScanQ = `
    SELECT price_asset FROM fractional.listings WHERE network = ? ALLOW FILTERING
  `;
  const assetsR = await cassandra.execute(assetsScanQ, [params.network], {
    prepare: true,
  });
  const uniqueAssets = new Set(
    assetsR.rows.map((row) => (row.get("price_asset") as string) || "")
  ).size;

  // Get unique vaults (scan + dedupe; MV later)
  const vaultsScanQ = `
    SELECT vault_id FROM fractional.listings WHERE network = ? ALLOW FILTERING
  `;
  const vaultsR = await cassandra.execute(vaultsScanQ, [params.network], {
    prepare: true,
  });
  const uniqueVaults = new Set(
    vaultsR.rows.map((row) => (row.get("vault_id") as string) || "")
  ).size;

  // Calculate total volume (sum of price_amount * amount for all listings)
  // Compute total volume client-side to avoid CAST/SUM quirks in dev
  const volumeScanQ = `
    SELECT price_amount, amount FROM fractional.listings WHERE network = ? ALLOW FILTERING
  `;
  const volumeR = await cassandra.execute(volumeScanQ, [params.network], {
    prepare: true,
  });
  const totalVolume = volumeR.rows
    .map((row) => {
      const pa = Number((row.get("price_amount") as string) || "0");
      const amt = Number((row.get("amount") as string) || "0");
      return pa * amt;
    })
    .reduce((a, b) => a + b, 0)
    .toString();

  // Calculate open volume (only OPEN listings)
  const openVolumeScanQ = `
    SELECT price_amount, amount FROM fractional.listings WHERE network = ? AND status = 'open' ALLOW FILTERING
  `;
  const openVolumeR = await cassandra.execute(
    openVolumeScanQ,
    [params.network],
    {
      prepare: true,
    }
  );
  const openVolume = openVolumeR.rows
    .map((row) => {
      const pa = Number((row.get("price_amount") as string) || "0");
      const amt = Number((row.get("amount") as string) || "0");
      return pa * amt;
    })
    .reduce((a, b) => a + b, 0)
    .toString();

  return {
    totalListings,
    openListings,
    totalVolume,
    openVolume,
    uniqueAssets,
    uniqueVaults,
  };
}
