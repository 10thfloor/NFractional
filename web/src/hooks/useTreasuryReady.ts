"use client";

import { useEffect, useState } from "react";
import { getTreasuryStatus, type TreasuryStatus } from "@/lib/api/pools";

export function useTreasuryReady(vaultId: string) {
  const [ready, setReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TreasuryStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReady(false);
    setStatus(null);
    (async () => {
      try {
        const s = await getTreasuryStatus(vaultId);
        if (cancelled) return;
        setStatus(s);
        setReady(Boolean(s?.platformFlow && s?.platformShare && s?.vaultFlow && s?.vaultShare));
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setReady(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  return { ready, loading, error, status, setReady } as const;
}


