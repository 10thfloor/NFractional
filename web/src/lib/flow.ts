// Remote admin authorization using backend signer via wallet challenge flow
// - Fetches addr/keyId from /flow/admin-info
// - Issues challenge (/api/auth/admin/challenge), wallet signs challenge
// - Proxies to backend via /api/admin/sign which forwards to /flow/admin-sign
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
        // Secure wallet challenge → response → server co-sign flow
        const toHex = (s: string): string => {
          const enc = new TextEncoder();
          const bytes = enc.encode(s);
          let hex = "";
          for (let i = 0; i < bytes.length; i++) {
            const h = bytes[i].toString(16).padStart(2, "0");
            hex += h;
          }
          return hex;
        };

        // 1) Request challenge (sets HttpOnly single-use nonce cookie)
        const chRes = await fetch("/api/auth/admin/challenge", {
          method: "GET",
          cache: "no-store",
        });
        if (!chRes.ok) {
          throw new Error(`Challenge error: ${await chRes.text()}`);
        }
        const { challenge } = (await chRes.json()) as { challenge: string };

        // 2) Sign challenge with connected wallet (hex message)
        type CurrentUserClient = {
          snapshot: () => Promise<{ addr?: string }>;
          signUserMessage: (msgHex: string) => Promise<unknown>;
        };
        const fclAny = admin.fcl as unknown as
          | {
              currentUser: () => CurrentUserClient;
            }
          | undefined;
        if (!fclAny)
          throw new Error("FCL client unavailable for wallet signing");
        const currentUserClient = fclAny.currentUser();
        const user = await currentUserClient.snapshot();
        if (!user?.addr) throw new Error("Wallet not connected");

        const hexChallenge = toHex(challenge);
        const sigResult = await currentUserClient.signUserMessage(hexChallenge);
        const signatures = Array.isArray(sigResult) ? sigResult : [sigResult];

        // 3) Proxy to server to verify wallet proof and forward to backend for admin co-sign
        const res = await fetch("/api/admin/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signable, challenge, signatures }),
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
