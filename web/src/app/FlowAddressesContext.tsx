"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type FlowAddresses = {
  ft: string | null;
  flow: string | null;
  ftmdv: string | null;
  mdv: string | null;
  fractional: string | null;
  ftcon: string | null;
  swapcon: string | null;
  swapcfg: string | null;
  amm: string | null;
  ammswapper: string | null;
  nft: string | null;
  example: string | null;
  platformAdmin: string | null;
};

const defaultValue: FlowAddresses = {
  ft: null,
  flow: null,
  ftmdv: null,
  mdv: null,
  fractional: null,
  ftcon: null,
  swapcon: null,
  swapcfg: null,
  amm: null,
  ammswapper: null,
  nft: null,
  example: null,
  platformAdmin: null,
};

const FlowAddressesContext = createContext<FlowAddresses>(defaultValue);

export function useFlowAddresses(): FlowAddresses {
  return useContext(FlowAddressesContext);
}

export function FlowAddressesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [addresses, setAddresses] = useState<FlowAddresses>(defaultValue);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    fetch(`${API}/flow/addresses`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data) => {
        setAddresses({
          ft: data.ft ?? null,
          flow: data.flow ?? null,
          ftmdv: data.ftmdv ?? null,
          mdv: data.mdv ?? null,
          fractional: data.fractional ?? null,
          ftcon: data.ftcon ?? null,
          swapcon: data.swapcon ?? null,
          swapcfg: data.swapcfg ?? null,
          amm: data.amm ?? null,
          ammswapper: data.ammswapper ?? null,
          nft: data.nft ?? null,
          example: data.example ?? null,
          platformAdmin: data.platformAdmin ?? null,
        });
      })
      .catch(() => {
        setAddresses(defaultValue);
      });
  }, []);

  const value = useMemo(() => addresses, [addresses]);

  return (
    <FlowAddressesContext.Provider value={value}>
      {children}
    </FlowAddressesContext.Provider>
  );
}
