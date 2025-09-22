"use client";

import { useEffect, useState } from "react";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import { getEscrowBalance } from "@/lib/api/vault";

export function useUserShareBalance(vaultId: string) {
  const { user } = useFlowCurrentUser();
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.addr) {
        setBalance("0");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const userBalance = await getEscrowBalance(vaultId, user.addr);
        if (!cancelled) {
          setBalance(userBalance || "0");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setBalance("0");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.addr, vaultId]);

  return {
    balance,
    loading,
    error,
    userAddr: user?.addr || null,
    isConnected: Boolean(user?.addr),
  } as const;
}
