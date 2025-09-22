"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NETWORK, gqlFetch } from "@/lib/graphql";

type FeeParams = {
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
} | null;

type Quote = {
  priceAmount: string;
  feeAmount: string;
  totalPay: string;
  feeBps: number;
};

export function useFeeParams(vaultId: string | undefined) {
  const [data, setData] = useState<FeeParams>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!vaultId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = `
          query($network:String!, $vaultId:String!){
            feeParams(network:$network, vaultId:$vaultId){ feeBps vaultSplitBps protocolSplitBps }
          }
        `;
        const resp = await gqlFetch<{ feeParams: FeeParams }>(q, {
          network: DEFAULT_NETWORK,
          vaultId,
        });
        if (!cancelled) setData(resp.feeParams ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);
  return { data, loading, error } as const;
}

export function useQuoteWithFees(
  vaultId: string | undefined,
  priceAmount: string | undefined
) {
  const [data, setData] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!vaultId || !priceAmount || Number(priceAmount) <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = `
          query($network:String!, $vaultId:String!, $priceAmount:String!){
            quoteWithFees(network:$network, vaultId:$vaultId, priceAmount:$priceAmount){ priceAmount feeAmount totalPay feeBps }
          }
        `;
        const resp = await gqlFetch<{ quoteWithFees: Quote }>(q, {
          network: DEFAULT_NETWORK,
          vaultId,
          priceAmount,
        });
        if (!cancelled) setData(resp.quoteWithFees);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId, priceAmount]);
  return { data, loading, error } as const;
}
