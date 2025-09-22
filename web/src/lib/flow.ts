// Remote admin authorization using backend signer
// - Fetches addr/keyId from /flow/admin-info
// - Posts signable to /flow/admin-sign to get signature
export type FlowAuthorizationFn = (
  account: unknown
) => Promise<unknown> | unknown;

export function makeAdminAuth(admin: {
  addr: string;
  keyId: number;
}): FlowAuthorizationFn {
  const adminAuth = (acct: unknown) => {
    if (!admin) throw new Error("Admin signer not ready");
    const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const addrNoPrefix = String(admin.addr || "0x0").replace(/^0x/, "");
    const keyId = Number(admin.keyId || 0);

    return {
      ...(acct as {
        tempId: string;
        addr: string;
        keyId: number;
        sequenceNum: number | null;
      }),
      tempId: `${addrNoPrefix}-${keyId}`,
      // FCL expects addr sans 0x on the account object
      addr: addrNoPrefix,
      keyId,
      sequenceNum: null,
      signingFunction: async (signable: unknown) => {
        const res = await fetch(`${API}/flow/admin-sign`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signable }),
        });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();
        // Accept backend CompositeSignature as-is, otherwise adapt
        if (payload?.f_type && payload.f_vsn) {
          return payload;
        }
        if (payload?.signature) {
          return {
            f_type: "CompositeSignature",
            f_vsn: "1.0.0",
            addr: addrNoPrefix,
            keyId,
            signature: payload.signature,
          };
        }
        // If backend returned a raw string signature
        if (typeof payload === "string") {
          return {
            f_type: "CompositeSignature",
            f_vsn: "1.0.0",
            addr: addrNoPrefix,
            keyId,
            signature: payload,
          };
        }
        return payload;
      },
    };
  };
  return adminAuth;
}

// Cadence import helper and address types shared across tx builders
export type CadenceAddrsStd = {
  // FungibleToken standard
  ft?: string | null;
  // FlowToken (FLOW)
  flow?: string | null;
  // Fractional contract
  fractional?: string | null;
  // Metadata standards
  ftmdv?: string | null;
  mdv?: string | null;
  // Actions connectors
  ftcon?: string | null; // FungibleTokenConnectors
  swapcon?: string | null; // IncrementFiSwapConnectors
  swapcfg?: string | null; // SwapConfig
  // NFT standard
  nft?: string | null; // NonFungibleToken
  // Example NFT or additional contracts
  example?: string | null;
  // Admin account for platform escrow
  platformAdmin?: string | null;
  // AMM contracts
  amm?: string | null;
  ammswapper?: string | null;
};

export type ListingsStdAddrs = Pick<
  CadenceAddrsStd,
  | "ft"
  | "flow"
  | "fractional"
  | "ftcon"
  | "swapcon"
  | "swapcfg"
  | "amm"
  | "ammswapper"
> & {
  shareAddress?: string | null;
  shareContract?: string | null;
};

export type VaultStdAddrs = Pick<CadenceAddrsStd, "nft" | "fractional">;

export function imp(name: string, addr?: string | null): string {
  if (addr && addr.length > 0) {
    const normalized = addr.startsWith("0x") ? addr : `0x${addr}`;
    return `import ${name} from ${normalized}`;
  }
  return `import "${name}"`;
}

export function with0x(addr: string | undefined | null): string {
  const raw = String(addr || "").trim();
  if (raw.length === 0) return "0x";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}
