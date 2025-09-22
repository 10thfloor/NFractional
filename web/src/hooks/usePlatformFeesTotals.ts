"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NETWORK, gqlFetch } from "@/lib/graphql";

// Backward-compatible simple total
export function usePlatformFeesCollected(token = "FLOW"): string {
  const totals = usePlatformFeeTotals(token);
  return totals?.amountTotal ?? "0";
}

export type FeeTotals = {
  token?: string;
  amountTotal: string;
  vaultTotal: string;
  protocolTotal: string;
  updatedAt: string;
};

// Preferred: full totals object with updatedAt
export function usePlatformFeeTotals(token = "FLOW"): FeeTotals | null {
  const [totals, setTotals] = useState<FeeTotals | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = `
          query FeeTotals($network: String!, $token: String!) {
            feeTotals(network: $network, token: $token) {
              token amountTotal vaultTotal protocolTotal updatedAt
            }
          }
        `;
        const resp = await gqlFetch<{ feeTotals?: FeeTotals | null }>(q, {
          network: DEFAULT_NETWORK,
          token,
        });
        if (!cancelled) setTotals(resp.feeTotals ?? null);
      } catch {
        if (!cancelled) setTotals(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
  return totals;
}
