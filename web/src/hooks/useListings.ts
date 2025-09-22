"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchListings } from "@/lib/api/listings";
import type { Listing } from "@/types/listings";

export function useListings(vaultId: string): {
  listings: Listing[];
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ls = await fetchListings(vaultId);
      setListings(ls);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { listings, reload, loading, error };
}
