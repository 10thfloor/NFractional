"use client";

import { useEffect, useState } from "react";
import { hasShareSetupScript } from "@/lib/tx/listings";
import type { CadenceAddrsStd } from "@/lib/flow";

export function useShareSetup(
  userAddr: string | undefined,
  vaultSymbol: string,
  ftAddrs: CadenceAddrsStd["ft"],
  fcl: any
): boolean {
  const [hasShareSetup, setHasShareSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!userAddr || !vaultSymbol) return;
        const result = await fcl.query({
          cadence: hasShareSetupScript(ftAddrs),
          args: (arg: any, t: any) => [
            arg(userAddr, t.Address),
            arg(vaultSymbol, t.String),
          ],
          limit: 9999,
        });
        if (!cancelled) setHasShareSetup(Boolean(result));
      } catch {
        if (!cancelled) setHasShareSetup(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [userAddr, vaultSymbol, ftAddrs, fcl]);

  return hasShareSetup;
}
