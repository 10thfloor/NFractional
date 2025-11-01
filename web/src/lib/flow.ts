// Remote admin authorization using backend signer
// - Fetches addr/keyId from /flow/admin-info
// - Posts signable to /flow/admin-sign to get signature
export type FlowAuthorizationFn = (
  account: unknown
) => Promise<unknown> | unknown;

/**
 * Refreshes account info to ensure we have the latest sequence number
 * This is important to avoid sequence number mismatch errors
 */
async function refreshAccountInfo(
  fcl: { account: (address: string) => Promise<unknown> },
  address: string
): Promise<void> {
  try {
    // Fetch fresh account info - this will update FCL's internal cache
    const addrNoPrefix = address.replace(/^0x/, "");
    await fcl.account(addrNoPrefix);
  } catch (e) {
    // If refresh fails, log but don't throw - FCL will still fetch on transaction build
    console.warn("[flow] Failed to refresh account info:", e);
  }
}

export function makeAdminAuth(admin: {
  addr: string;
  keyId: number;
  fcl?: { account: (address: string) => Promise<unknown> }; // Optional FCL instance for account refresh
}): FlowAuthorizationFn {
  const adminAuth = async (acct: unknown) => {
    if (!admin) throw new Error("Admin signer not ready");
    const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const addrNoPrefix = String(admin.addr || "0x0").replace(/^0x/, "");
    const keyId = Number(admin.keyId || 0);

    // Always fetch fresh account info to ensure correct sequence number
    // This ensures we get the latest sequence number, not a cached one
    if (admin.fcl) {
      await refreshAccountInfo(admin.fcl, admin.addr);
    }

    // FCL will fetch account info if sequenceNum is null or undefined
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
      // Setting sequenceNum to null tells FCL to fetch the latest account info
      sequenceNum: null,
      signingFunction: async (signable: unknown) => {
        // Note: Backend authentication is optional - backend only requires auth
        // if FLOW_ADMIN_SIGN_SECRET is explicitly set via environment variable.
        // In local development, if not set, the endpoint works without auth.
        // Secrets cannot be stored in NEXT_PUBLIC_ variables as they're exposed to the browser.
        const res = await fetch(`${API}/flow/admin-sign`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signable }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `HTTP ${res.status}`);
        }
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
