import * as fcl from "@onflow/fcl";
// Source-of-truth: for AMM quote see flow/cadence/scripts/pools/QuoteViaActions.cdc; for ExampleNFT and other scripts, see flow/cadence/scripts
import ENV from "../lib/env";
import with0x from "../lib/addr";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { getCadence } from "../lib/cadence";

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

export async function scriptExampleNFTGetIDs(
  account: string
): Promise<string[]> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/ExampleNFTGetIDs.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(acc, t.Address)],
  });
  // resp is number[] (UInt64) -> stringify for GraphQL consistency
  return (resp as number[]).map((n) => String(n));
}

// Check if a vaultId exists on-chain via Fractional.getVault
export async function scriptVaultIdExists(vaultId: string): Promise<boolean> {
  setAccessNode();
  const code = getCadence("scripts/GetVault.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  });
  return resp != null;
}

// Resolve vaultId by share symbol; returns null if not found
export async function scriptVaultIdBySymbol(
  symbol: string
): Promise<string | null> {
  setAccessNode();
  const code = getCadence("scripts/GetVaultIdBySymbol.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(symbol, t.String)],
  });
  return (resp as string | null) ?? null;
}

// Enumerate public NFT collections on an account by scanning public paths
// and checking for NonFungibleToken.CollectionPublic conformance.
// Also resolves the actual storage path by matching type IDs.
export async function scriptListNftCollections(
  account: string
): Promise<{ publicPath: string; typeId: string; storagePath?: string }[]> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;

  // Get public collections
  const publicCode = getCadence("scripts/ListNftCollections.cdc");
  const publicCollections = (await fcl.query({
    cadence: publicCode,
    args: (arg: any, t: any) => [arg(acc, t.Address)],
  })) as Array<Record<string, string>>;

  // Get storage collections (which have actual storage paths)
  const storageCollections = await scriptListNftStorageCollections(account);

  // Match public collections with storage paths by typeId
  const result = publicCollections.map((pub) => {
    const storagePath = storageCollections.find(
      (storage) => storage.typeId === pub.typeId
    )?.storagePath;

    return {
      publicPath: pub.publicPath,
      typeId: pub.typeId,
      storagePath: storagePath || undefined,
    };
  });

  return result;
}

// Get NFT IDs for an arbitrary collection given its public path identifier
export async function scriptGetCollectionIds(
  account: string,
  publicPathIdentifier: string
): Promise<string[]> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/GetCollectionIds.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(acc, t.Address),
      arg(publicPathIdentifier, t.String),
    ],
  });
  return (resp as number[]).map((n) => String(n));
}

// Resolve storage path identifier for a given public path by inspecting provider references
export async function scriptResolveStoragePathFromPublic(
  account: string,
  publicPathIdentifier: string
): Promise<string | null> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/ResolveStoragePathFromPublic.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(acc, t.Address),
      arg(publicPathIdentifier, t.String),
    ],
  });
  return (resp as string | null) ?? null;
}

// Enumerate storage paths that store an NFT collection implementing Provider
export async function scriptListNftStorageCollections(
  account: string
): Promise<{ storagePath: string; typeId: string }[]> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/ListNftStorageCollections.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(acc, t.Address)],
  })) as Array<Record<string, string>>;
  return resp.map((r) => ({ storagePath: r.storagePath, typeId: r.typeId }));
}

// Resolve MetadataViews.Display via generic collection public path
export async function scriptGetNFTDisplay(
  account: string,
  publicPathIdentifier: string,
  tokenId: string
): Promise<{ name: string; description: string; thumbnail: string } | null> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/GetNFTDisplay.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(acc, t.Address),
      arg(publicPathIdentifier, t.String),
      arg(Number(tokenId || "0"), t.UInt64),
    ],
  })) as null | Record<string, string>;
  if (!resp) return null;
  return {
    name: String(resp.name || ""),
    description: String(resp.description || ""),
    thumbnail: String(resp.thumbnail || ""),
  };
}

// Read MetadataViews.Display for an NFT given account, public path identifier and token ID
export async function scriptNftDisplay(
  account: string,
  publicPathIdentifier: string,
  tokenId: string
): Promise<{ name: string; description: string; thumbnail: string } | null> {
  setAccessNode();
  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/NftDisplay.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(acc, t.Address),
      arg(publicPathIdentifier, t.String),
      arg(Number(tokenId || "0"), t.UInt64),
    ],
  })) as null | Record<string, string>;
  if (!resp) return null;
  return {
    name: String(resp.name || ""),
    description: String(resp.description || ""),
    thumbnail: String(resp.thumbnail || ""),
  };
}

// Read MetadataViews.Display via Fractional custody public capability
export async function scriptVaultCustodyDisplay(
  account: string,
  vaultId: string,
  tokenId: string
): Promise<{ name: string; description: string; thumbnail: string } | null> {
  setAccessNode();

  const acc = account.startsWith("0x") ? account : `0x${account}`;
  const code = getCadence("scripts/VaultCustodyDisplay.cdc");

  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(acc, t.Address),
      arg(vaultId, t.String),
      arg(Number(tokenId || "0"), t.UInt64),
    ],
  });

  if (!resp) return null;
  return {
    name: String(resp.name || ""),
    description: String(resp.description || ""),
    thumbnail: String(resp.thumbnail || ""),
  };
}

// Read per-vault fee parameters from Fractional
export async function scriptFeeParams(vaultId: string): Promise<{
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
} | null> {
  setAccessNode();
  const code = getCadence("scripts/GetFeeParams.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  })) as null | Record<string, unknown>;
  if (!resp) return null;
  const feeBps = Number((resp as Record<string, unknown>).feeBps ?? 0);
  const vaultSplitBps = Number(
    (resp as Record<string, unknown>).vaultSplitBps ?? 0
  );
  const protocolSplitBps = Number(
    (resp as Record<string, unknown>).protocolSplitBps ?? 0
  );
  return { feeBps, vaultSplitBps, protocolSplitBps };
}

export async function scriptPendingFeeParams(vaultId: string): Promise<{
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
  effectiveAt: number;
} | null> {
  setAccessNode();
  const code = getCadence("scripts/GetPendingFeeParams.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  })) as null | Record<string, unknown>;
  if (!resp) return null;
  return {
    feeBps: Number((resp as any).feeBps ?? 0),
    vaultSplitBps: Number((resp as any).vaultSplitBps ?? 0),
    protocolSplitBps: Number((resp as any).protocolSplitBps ?? 0),
    effectiveAt: Number((resp as any).effectiveAt ?? 0),
  };
}

// Read platform admin FlowToken vault balance (fees sink in current design)
export async function scriptPlatformFeesBalance(): Promise<string> {
  setAccessNode();
  const admin = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  const code = getCadence("scripts/GetPlatformTreasuryBalance.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(admin, t.Address)],
  });
  // Return as string for GraphQL consistency
  return String(resp ?? "0.0");
}

// Reads the FlowToken balance of the Platform Treasury vault
export async function scriptPlatformTreasuryBalance(): Promise<string> {
  setAccessNode();
  const admin = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  const code = getCadence("scripts/GetPlatformTreasuryBalance.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(admin, t.Address)],
  });
  return String(resp ?? "0.0");
}

// Compute team LP share equivalent of the share reserve for a single pool via Cadence script
export async function scriptTeamLPShareEquivalent(input: {
  poolOwner: string;
  poolId: string;
  team: string[];
}): Promise<string> {
  setAccessNode();
  const owner = input.poolOwner.startsWith("0x")
    ? input.poolOwner
    : `0x${input.poolOwner}`;
  const code = getCadence("scripts/pools/GetTeamLPShareEquivalent.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(owner, t.Address),
      arg(input.poolId, t.String),
      arg(
        input.team.map((a) => (a.startsWith("0x") ? a : `0x${a}`)),
        t.Array(t.Address)
      ),
    ],
  });
  return String(resp ?? "0.0");
}

export async function scriptVaultTreasuryBalance(
  vaultId: string
): Promise<string> {
  setAccessNode();
  const admin = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  const code = getCadence("scripts/GetVaultTreasuryBalance.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(admin, t.Address), arg(vaultId, t.String)],
  });
  return String(resp ?? "0.0");
}

export async function scriptVaultTreasuryShareBalance(
  vaultId: string
): Promise<string> {
  setAccessNode();
  const admin = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  const code = getCadence("scripts/GetVaultTreasuryShareBalance.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(admin, t.Address), arg(vaultId, t.String)],
  });
  return String(resp ?? "0.0");
}

// Quote fees via on-chain FeeRouter script
export async function scriptQuoteFees(
  vaultId: string,
  amount: string
): Promise<{
  feeBps: string;
  feeAmount: string;
  vaultShare: string;
  protocolShare: string;
}> {
  setAccessNode();
  const code = getCadence("scripts/QuoteFees.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String), arg(amount, t.UFix64)],
  })) as Record<string, string | number>;
  return {
    feeBps: String(resp.feeBps || "0"),
    feeAmount: String(resp.feeAmount || "0.0"),
    vaultShare: String(resp.vaultShare || "0.0"),
    protocolShare: String(resp.protocolShare || "0.0"),
  };
}

// Quote AMM out amount via on-chain pool adapter
export async function scriptAmmQuoteViaActions(input: {
  poolOwner: string;
  poolId: string;
  direction: "share_to_flow" | "flow_to_share";
  amountIn: string;
}): Promise<{ in: string; out: string }> {
  setAccessNode();
  const code = getCadence("scripts/pools/QuoteViaActionsByOwner.cdc");
  const owner = input.poolOwner.startsWith("0x")
    ? input.poolOwner
    : `0x${input.poolOwner}`;
  const dir = input.direction === "share_to_flow" ? "0" : "1";
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(owner, t.Address),
      arg(input.poolId, t.String),
      arg(dir, t.UInt8),
      arg(input.amountIn, t.UFix64),
    ],
  })) as { in: string; out: string };
  return { in: String(resp.in || "0.0"), out: String(resp.out || "0.0") };
}

// AMM quote including platform fee and split breakdown
export async function scriptAmmQuoteWithFees(input: {
  poolOwner: string;
  poolId: string;
  direction: "share_to_flow" | "flow_to_share";
  amountIn: string;
  vaultId: string;
}): Promise<{
  in: string;
  out: string;
  feeAmount: string;
  feeBps: number;
  vaultShare: string;
  protocolShare: string;
}> {
  setAccessNode();
  const code = getCadence("scripts/pools/AmmQuoteWithFees.cdc");
  const owner = input.poolOwner.startsWith("0x")
    ? input.poolOwner
    : `0x${input.poolOwner}`;
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [
      arg(owner, t.Address),
      arg(input.poolId, t.String),
      arg(input.direction, t.String),
      arg(input.amountIn, t.UFix64),
      arg(input.vaultId, t.String),
    ],
  })) as Record<string, string | number>;
  return {
    in: String(resp.in || "0.0"),
    out: String(resp.out || "0.0"),
    feeAmount: String(resp.feeAmount || "0.0"),
    feeBps: Number(resp.feeBps || 0),
    vaultShare: String(resp.vaultShare || "0.0"),
    protocolShare: String(resp.protocolShare || "0.0"),
  };
}

export async function txScheduleFeeParams(input: {
  vaultId: string;
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
  effectiveAt: number;
}): Promise<string> {
  setAccessNode();
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const code = getCadence("transactions/vault/admin/schedule-fee-params.cdc");
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        (fcl as any).arg(input.vaultId, (fcl as any).t.String),
        (fcl as any).arg(String(input.feeBps), (fcl as any).t.UInt64),
        (fcl as any).arg(String(input.vaultSplitBps), (fcl as any).t.UInt64),
        (fcl as any).arg(String(input.protocolSplitBps), (fcl as any).t.UInt64),
        (fcl as any).arg(String(input.effectiveAt), (fcl as any).t.UInt64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return txId as string;
}

export async function txActivateFeeParams(input: {
  vaultId: string;
  currentHeight: number;
}): Promise<string> {
  setAccessNode();
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const code = getCadence("transactions/vault/admin/activate-fee-params.cdc");
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        (fcl as any).arg(input.vaultId, (fcl as any).t.String),
        (fcl as any).arg(String(input.currentHeight), (fcl as any).t.UInt64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return txId as string;
}

export async function txScheduleFeeActivation(input: {
  vaultId: string;
}): Promise<string> {
  setAccessNode();
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const code = getCadence("transactions/scheduler/admin/scheduleV2.cdc");
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        (fcl as any).arg(input.vaultId, (fcl as any).t.String),
        (fcl as any).arg("10.0", (fcl as any).t.UFix64),
        (fcl as any).arg("1", (fcl as any).t.UInt8),
        (fcl as any).arg("100", (fcl as any).t.UInt64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return txId as string;
}

// Ensure platform and per-vault treasury FlowToken vaults and receiver caps exist
export async function txEnsureTreasuryCaps(input: {
  vaultId: string;
}): Promise<string> {
  setAccessNode();
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const code = getCadence("transactions/treasury/admin/ensure-caps.cdc");
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([(fcl as any).arg(input.vaultId, (fcl as any).t.String)]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return txId as string;
}

export async function txMintExampleNFTTo(input: {
  recipient: string;
  name?: string;
  description?: string;
  thumbnail?: string;
}): Promise<string> {
  setAccessNode();

  const recipient = input.recipient.startsWith("0x")
    ? input.recipient
    : `0x${input.recipient}`;

  if (!recipient) throw new Error("recipient required");
  const code = getCadence("transactions/example-nft/admin/mint-to.cdc");
  // Only log Cadence code in development
  if (process.env.NODE_ENV === "development") {
    console.log("code", code);
  }

  const signerAddr = ENV.FLOW_MINTER_ADDR;
  const signerKey = ENV.FLOW_MINTER_KEY;

  if (!signerAddr || !signerKey) {
    throw new Error("FLOW_MINTER_ADDR and FLOW_MINTER_KEY must be set");
  }

  const { proposer } = getLocalAuthTriplet(signerAddr, signerKey, 0);

  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        (fcl as any).arg(recipient, (fcl as any).t.Address),
        (fcl as any).arg(
          input.name ??
            `Rare Digital Artifact ${Math.random()
              .toString(36)
              .substring(2, 15)}`,
          (fcl as any).t.String
        ),
        (fcl as any).arg(
          input.description ??
            "A rare, high-value digital artifact minted for vault showcase.",
          (fcl as any).t.String
        ),
        (fcl as any).arg(
          input.thumbnail ??
            `https://picsum.photos/seed/${Math.random()
              .toString(36)
              .substring(2, 15)}/200/300`,
          (fcl as any).t.String
        ),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return txId as string;
}

export async function scriptAmmFeeParams(vaultId: string): Promise<{
  feeBps: number;
  vaultSplitBps: number;
  protocolSplitBps: number;
}> {
  setAccessNode();
  const code = `
    import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
    access(all) fun main(vaultId: String): {String: UInt64} {
      return Fractional.getAmmFeeParams(vaultId: vaultId)
    }
  `;
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  })) as Record<string, string | number>;
  return {
    feeBps: Number(resp.ammFeeBps || 0),
    vaultSplitBps: Number(resp.ammFeeSplitVaultBps || 0),
    protocolSplitBps: Number(resp.ammFeeSplitProtocolBps || 0),
  };
}

// Custody status sourced on-chain from vault metadata (custodian derived in Cadence)
export async function scriptVaultCustodyStatus(
  vaultId: string
): Promise<boolean> {
  setAccessNode();
  const code = getCadence("scripts/VaultCustodyStatus.cdc");
  const resp = await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  });
  return Boolean(resp);
}

// LockBox-only vault NFT display (derive custodian on-chain)
export async function scriptVaultLockBoxDisplay(
  vaultId: string
): Promise<{ name: string; description: string; thumbnail: string } | null> {
  setAccessNode();
  const code = getCadence("scripts/VaultCustodyDisplay.cdc");
  const resp = (await fcl.query({
    cadence: code,
    args: (arg: any, t: any) => [arg(vaultId, t.String)],
  })) as null | Record<string, string>;
  if (!resp) return null;
  return {
    name: String(resp.name || ""),
    description: String(resp.description || ""),
    thumbnail: String(resp.thumbnail || ""),
  };
}
