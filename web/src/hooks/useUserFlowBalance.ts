"use client";

import { useEffect, useState } from "react";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { getWalletBalancesScriptAliased } from "@/lib/tx/scripts";

export function useUserFlowBalance() {
  const { user } = useFlowCurrentUser();
  const fcl = useFlowClient();
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.addr || !user?.loggedIn) {
        setBalance("0");
        return;
      }

      setLoading(true);
      try {
        const res = (await (fcl as any).query({
          cadence: await getWalletBalancesScriptAliased(),
          args: (arg: (v: unknown, t: any) => unknown, t: any) => [
            arg(user.addr, t.Address),
            arg("", t.String), // Empty vaultSymbol, we only need FLOW
            arg(null, t.Optional(t.String)), // No poolId needed
          ],
        })) as Record<string, string>;

        if (!cancelled && res) {
          setBalance(String(res.flow || "0.0"));
        }
      } catch {
        if (!cancelled) {
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
  }, [user?.addr, user?.loggedIn, fcl]);

  return { balance, loading, address: user?.addr || null };
}

