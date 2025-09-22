"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NETWORK, gqlFetch } from "@/lib/graphql";

// Reads Platform Treasury balance via GraphQL API resolver.
export function usePlatformTreasuryBalance(): string {
  const [bal, setBal] = useState<string>("0");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = `
          query($network:String!){ platformTreasuryBalance(network:$network) }
        `;
        const resp = await gqlFetch<{ platformTreasuryBalance: string }>(q, {
          network: DEFAULT_NETWORK,
        });
        if (!cancelled) setBal(resp.platformTreasuryBalance ?? "0");
      } catch {
        if (!cancelled) setBal("0");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return bal;
}
