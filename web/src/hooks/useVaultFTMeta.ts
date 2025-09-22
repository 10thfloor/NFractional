"use client";

import { useEffect, useState } from "react";
import { fetchVaultFTMeta } from "@/lib/api/listings";
import type { ShareTokenMeta } from "@/types/listings";

export function useVaultFTMeta(vaultId: string): {
  ftMeta: ShareTokenMeta | null;
  loading: boolean;
} {
  const [ftMeta, setMeta] = useState<ShareTokenMeta | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const meta = await fetchVaultFTMeta(vaultId);

        if (!cancelled) setMeta(meta);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  return { ftMeta, loading };
}
