"use client";

import { useEffect, useState } from "react";
import { getVaultCustodyStatusScriptAliased } from "@/lib/tx/scripts";

/**
 * Reads custody liveness for a vault by querying Fractional.isCustodyAlive
 * using the LockBoxPublic capability. Uses the vault's creator as custodian.
 */
export function useVaultCustodyStatus(
  vaultId: string | undefined,
  fcl: any
): { alive: boolean; loading: boolean; error: string | null } {
  const [alive, setAlive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!vaultId) return;
      setLoading(true);
      setError(null);
      try {
        const cadence = await getVaultCustodyStatusScriptAliased();
        const res = (await fcl.query({
          cadence,
          args: (arg: any, t: any) => [arg(vaultId, t.String)],
          limit: 9999,
        })) as boolean | null;
        if (!cancelled) setAlive(Boolean(res));
      } catch (e) {
        if (!cancelled) {
          setAlive(false);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [vaultId, fcl]);

  return { alive, loading, error };
}
