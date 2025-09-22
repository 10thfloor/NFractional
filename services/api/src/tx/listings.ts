import * as fcl from "@onflow/fcl";
import ENV from "../lib/env";
import with0x from "../lib/addr";
import { getCadence } from "../lib/cadence";
import { aliasVaultShareImport } from "../lib/addr";
import { Decimal, formatUFix64 } from "../lib/num";
import { txEnsureAdminCapsInternal as _txEnsureAdminCapsInternal } from "../tx/shares";

export type PreparedListingTxArg = {
  type: "Address" | "String" | "UFix64";
  value: string;
};

export type PreparedListingTx = {
  cadence: string;
  args: PreparedListingTxArg[];
  limit: number;
};

export type PrepareListingInput = {
  seller: string;
  vaultId: string;
  listingId: string;
  priceAsset: string;
  priceAmount: string;
  amount: string;
};

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

function ensureAddress(addr: string, label: string): string {
  const normalized = with0x(addr);
  if (!/^0x[0-9a-fA-F]{16}$/.test(normalized)) {
    throw new Error(`${label} must be a valid Flow address`);
  }
  return normalized;
}

function ensureDecimal(value: string, label: string): string {
  try {
    const d = new Decimal((value || "").toString());
    if (!d.isFinite() || d.isNegative()) throw new Error("invalid");
    return d.toString();
  } catch {
    throw new Error(`${label} must be a positive decimal`);
  }
}

type VaultFTMeta = {
  address: string;
  name: string;
  storage: string;
  receiver: string;
  balance?: string;
  symbol?: string;
};

async function fetchShareMetadata(vaultId: string): Promise<VaultFTMeta> {
  const cadence = `
    import Fractional from ${with0x(ENV.FLOW_CONTRACT_FRACTIONAL)}
    access(all) fun main(vaultId: String): {String: String}? {
      return Fractional.getVaultFT(vaultId: vaultId)
    }
  `;
  const result = (await fcl.query({
    cadence,
    args: (arg, t) => [arg(vaultId, t.String)],
  })) as { [key: string]: string } | null;

  if (!result) {
    throw new Error("share token metadata not registered for vault");
  }
  // Enrich with on-chain FT contract metadata (symbol/decimals) when possible
  const ftAddr = with0x(String(result.address || ""));
  const ftName = String(result.name || "");
  if (ftAddr && ftName) {
    const metaCode = `
      import ${ftName} from ${ftAddr}
      access(all) fun main(): {String: String} {
        var out: {String: String} = {}
        out["name"] = ${ftName}.name
        out["symbol"] = ${ftName}.symbol
        out["decimals"] = ${ftName}.decimals.toString()
        return out
      }
    `;
    try {
      const meta = (await fcl.query({
        cadence: metaCode,
        args: () => [],
      })) as Record<string, string> | null;
      if (meta && typeof meta.symbol === "string") {
        (result as VaultFTMeta).symbol = meta.symbol;
      }
    } catch (_e) {
      // ignore, symbol remains undefined
    }
  }
  return result as VaultFTMeta;
}

export async function prepareCreateListingTx(
  input: PrepareListingInput
): Promise<PreparedListingTx> {
  setAccessNode();

  const sellerAddr = ensureAddress(input.seller, "seller");
  const vaultId = input.vaultId.trim();
  const listingId = input.listingId.trim();
  const priceAsset = input.priceAsset.trim();
  const priceAmount = ensureDecimal(input.priceAmount, "priceAmount");
  const amount = ensureDecimal(input.amount, "amount");

  if (!vaultId) throw new Error("vaultId is required");
  if (!listingId) throw new Error("listingId is required");
  if (!priceAsset) throw new Error("priceAsset is required");

  const meta = await fetchShareMetadata(vaultId);
  const shareContract = meta.name;
  const shareAddress = ensureAddress(meta.address, "share address");
  const shareStorageIdentifier = meta.storage;
  const shareReceiverIdentifier = meta.receiver;
  const shareBalanceIdentifier = String(meta.balance || "");

  if (!shareContract || !shareStorageIdentifier || !shareReceiverIdentifier) {
    throw new Error("incomplete share token metadata for vault");
  }

  // Optional preflight: ensure admin escrow vault and public caps (receiver + balance)
  if (shareBalanceIdentifier) {
    try {
      // Reuse existing admin caps tx (idempotent)
      await _txEnsureAdminCapsInternal({
        symbol: String(meta.symbol || ""),
        contractName: shareContract,
        contractAddress: shareAddress,
        storagePath: shareStorageIdentifier,
        receiverPath: shareReceiverIdentifier,
        balancePath: shareBalanceIdentifier,
      } as unknown as import("./shares").ShareMetadata);
    } catch (_e) {
      // Non-fatal: listing tx will also publish receiver/balance as needed
    }
  }

  // Switch to safe dual-auth create (escrow + record)
  let cadence = getCadence("transactions/listings/user/create_safe.cdc");
  // Alias VaultShareToken in the Cadence source to the per‑vault FT
  cadence = aliasVaultShareImport(cadence, shareContract, shareAddress);

  const symbolStr: string = String(meta.symbol || "");
  const args: PreparedListingTxArg[] = [
    { type: "String", value: symbolStr },
    { type: "String", value: vaultId },
    { type: "String", value: listingId },
    { type: "String", value: priceAsset },
    { type: "UFix64", value: formatUFix64(priceAmount) },
    { type: "UFix64", value: formatUFix64(amount) },
    { type: "Address", value: sellerAddr },
  ];

  return {
    cadence,
    args,
    limit: 9999,
  };
}

export async function txSettleListing(input: {
  vaultId: string;
  listingId: string;
  buyer: string;
  shareAmount: string;
  priceAmount: string;
  seller: string;
}): Promise<string> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const listingId = input.listingId.trim();
  const buyer = ensureAddress(input.buyer, "buyer");
  const shareAmount = ensureDecimal(input.shareAmount, "shareAmount");
  const priceAmount = ensureDecimal(input.priceAmount, "priceAmount");
  const seller = ensureAddress(input.seller, "seller");
  if (!vaultId || !listingId) throw new Error("vaultId and listingId required");

  // Fetch per‑vault FT meta to alias VaultShareToken
  const meta = await fetchShareMetadata(vaultId);
  const contractName = meta.name;
  const contractAddr = ensureAddress(meta.address, "share address");

  let cadence = getCadence("transactions/listings/admin/settle-fill.cdc");
  // Alias the per‑vault FT correctly regardless of prior import rewriting
  // Handle both patterns: import "VaultShareToken" (before rewrite) and
  // import VaultShareToken from 0xADDR (after rewrite)
  cadence = cadence
    .replace(
      /import\s+["']VaultShareToken["']/g,
      `import ${contractName} as VaultShareToken from ${contractAddr}`
    )
    .replace(
      /import\s+VaultShareToken\s+from\s+0x[0-9a-fA-F]+/g,
      `import ${contractName} as VaultShareToken from ${contractAddr}`
    );

  const t = (await import("@onflow/types"))
    .default as typeof import("@onflow/types");
  const { getLocalAuthTriplet } = await import("../lib/flowAuth");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(contractName.replace(/^VaultShareToken_/, ""), t.String),
        fcl.arg(vaultId, t.String),
        fcl.arg(listingId, t.String),
        fcl.arg(buyer, t.Address),
        fcl.arg(formatUFix64(shareAmount), t.UFix64),
        fcl.arg(formatUFix64(priceAmount), t.UFix64),
        fcl.arg(seller, t.Address),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  await fcl.tx(txId as string).onceSealed();
  return txId as string;
}
