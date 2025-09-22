"use client";

import { useEffect, useState } from "react";
import type { CadenceAddrsStd } from "@/lib/flow";
import { poolInfoScript, type PoolInfo } from "@/lib/api/pools";

export function usePoolInfo(
  owner: string | undefined,
  poolId: string | undefined,
  addrs: Pick<CadenceAddrsStd, "ft" | "flow" | "amm">,
  fclQuery: (input: {
    cadence: string;
    args: (arg: (v: unknown, t: unknown) => unknown, t: unknown) => unknown[];
  }) => Promise<Record<string, string> | null>
): { info: PoolInfo | null; loading: boolean; error: string | null } {
  const [info, setInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!owner || !poolId) return;
      setLoading(true);
      setError(null);
      try {
        const cadence = poolInfoScript(
          addrs as unknown as {
            ft: string | null;
            flow: string | null;
            amm: string | null;
          }
        );
        const res = (await fclQuery({
          cadence,
          args: (arg: (v: unknown, t: unknown) => unknown, t: unknown) => {
            const tt = t as { Address: unknown; String: unknown };
            return [arg(owner, tt.Address), arg(poolId, tt.String)];
          },
        })) as Record<string, string> | null;
        if (cancelled) return;
        if (!res) {
          setInfo(null);
        } else {
          setInfo({
            vaultId: String(res.vaultId || ""),
            poolId: String(res.poolId || poolId),
            symbol: String(res.symbol || ""),
            feeBps: Number(res.feeBps || 0),
            reserves: {
              share: String(res.share || "0.0"),
              flow: String(res.flow || "0.0"),
            },
            shareTypeId: String(res.shareTypeId || ""),
          });
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [owner, poolId, addrs, fclQuery]);

  return { info, loading, error };
}
