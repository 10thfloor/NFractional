import * as fcl from "@onflow/fcl";
import ENV from "../lib/env";
import with0x from "../lib/addr";
import { getCadence } from "../lib/cadence";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { aliasVaultShareImport } from "../lib/addr";

export type ShareMetadata = {
  symbol: string;
  contractName: string;
  contractAddress: string;
  storagePath: string;
  receiverPath: string;
  balancePath: string;
};

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

function ensureDecimal(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) {
    throw new Error(`${label} must be a decimal string`);
  }
  return trimmed;
}

export async function fetchShareMetadata(
  vaultId: string
): Promise<ShareMetadata> {
  setAccessNode();
  const address = await fcl.query({
    cadence: getCadence("scripts/GetVaultFT.cdc"),
    args: (arg, t) => [arg(vaultId, t.String)],
  });
  if (!address) throw new Error("share token metadata missing");
  type VaultFTMetaDict = {
    address: string;
    name: string;
    storage: string;
    receiver: string;
    balance: string;
  };
  const metaDict = address as VaultFTMetaDict;
  const contractAddress = metaDict.address;
  const contractName = metaDict.name;
  const storagePath = metaDict.storage;
  const receiverPath = metaDict.receiver;
  const balancePath = metaDict.balance;
  if (
    !contractAddress ||
    !contractName ||
    !storagePath ||
    !receiverPath ||
    !balancePath
  ) {
    throw new Error("share token metadata incomplete");
  }
  const symbol = (await fcl.query({
    cadence: getCadence("scripts/GetVaultShareSymbol.cdc"),
    args: (arg, t) => [arg(vaultId, t.String)],
  })) as string;
  return {
    symbol,
    contractName,
    contractAddress: with0x(contractAddress),
    storagePath,
    receiverPath,
    balancePath,
  };
}

// Ensure admin escrow vault exists and required public capabilities are published
export async function txEnsureAdminCapsInternal(
  meta: ShareMetadata
): Promise<string> {
  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );
  let cadence = getCadence(
    "transactions/shares/admin/ensure_admin_caps_dynamic.cdc"
  );
  cadence = aliasVaultShareImport(
    cadence,
    meta.contractName,
    meta.contractAddress
  );
  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(meta.storagePath, fcl.t.String),
        fcl.arg(meta.receiverPath, fcl.t.String),
        fcl.arg(meta.balancePath, fcl.t.String),
      ]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  await fcl.tx(txId as string).onceSealed();
  return txId as string;
}

export async function txSetShareMaxSupply(input: {
  vaultId: string;
  maxSupply: string;
}): Promise<{ txId: string }> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const maxSupply = ensureDecimal(input.maxSupply, "maxSupply");
  if (!vaultId) throw new Error("vaultId required");

  const cadence = getCadence("transactions/vault/admin/set-max-supply.cdc");

  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(vaultId, fcl.t.String),
        fcl.arg(maxSupply, fcl.t.UFix64),
      ]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  await fcl.tx(txId as string).onceSealed();
  return { txId: txId as string };
}

export async function txMintShares(input: {
  vaultId: string;
  recipient: string;
  amount: string;
}): Promise<{ txId: string }> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const recipient = with0x(input.recipient);
  const amount = ensureDecimal(input.amount, "amount");
  if (!vaultId || !recipient) throw new Error("vaultId and recipient required");

  const meta = await fetchShareMetadata(vaultId);
  let cadence = getCadence("transactions/shares/admin/mint_dynamic.cdc");
  cadence = aliasVaultShareImport(
    cadence,
    meta.contractName,
    meta.contractAddress
  );

  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );

  // Before minting, check if it would exceed max supply
  // Wrap in try-catch to handle cases where queries fail (e.g., vault not fully set up)
  try {
    const currentTotalSupplyStr = await scriptVaultTotalSupply(vaultId);
    const maxSupplyStr = await scriptVaultMaxSupply(vaultId);
    const mintAmount = Number(amount);

    // If maxSupply is null, there's no cap (unbounded)
    if (maxSupplyStr) {
      const currentTotalSupply = Number(currentTotalSupplyStr ?? "0");
      const maxSupply = Number(maxSupplyStr);

      if (
        !Number.isFinite(currentTotalSupply) ||
        !Number.isFinite(maxSupply) ||
        !Number.isFinite(mintAmount)
      ) {
        throw new Error("Invalid supply values");
      }

      if (currentTotalSupply + mintAmount > maxSupply) {
        throw new Error(
          `Minting ${amount} would exceed max supply of ${maxSupply}. Current supply: ${currentTotalSupply}`
        );
      }
    }
  } catch (error) {
    // If max supply check fails (e.g., vault not set up), log warning but proceed
    // On-chain enforcement will still prevent exceeding max supply
    const errorMsg = (error as Error).message;
    if (errorMsg.includes("would exceed max supply")) {
      // Re-throw explicit max supply errors
      throw error;
    }
    // For other errors (query failures, etc.), log and proceed
    // The on-chain pre-condition will still enforce max supply
    console.warn(
      `Could not verify max supply before minting for vault ${vaultId}:`,
      errorMsg
    );
  }

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(recipient, fcl.t.Address),
        fcl.arg(amount, fcl.t.UFix64),
      ]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  await fcl.tx(txId as string).onceSealed();
  return { txId: txId as string };
}

export async function txMintSharesToTreasury(input: {
  vaultId: string;
  amount: string;
}): Promise<{ txId: string }> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const amount = ensureDecimal(input.amount, "amount");
  if (!vaultId) throw new Error("vaultId required");

  const meta = await fetchShareMetadata(vaultId);
  let cadence = getCadence(
    "transactions/shares/admin/mint_to_treasury_dynamic.cdc"
  );
  cadence = aliasVaultShareImport(
    cadence,
    meta.contractName,
    meta.contractAddress
  );

  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );

  // Before minting, check if it would exceed max supply
  // Wrap in try-catch to handle cases where queries fail (e.g., vault not fully set up)
  try {
    const currentTotalSupplyStr = await scriptVaultTotalSupply(vaultId);
    const maxSupplyStr = await scriptVaultMaxSupply(vaultId);
    const mintAmount = Number(amount);

    // If maxSupply is null, there's no cap (unbounded)
    if (maxSupplyStr) {
      const currentTotalSupply = Number(currentTotalSupplyStr ?? "0");
      const maxSupply = Number(maxSupplyStr);

      if (
        !Number.isFinite(currentTotalSupply) ||
        !Number.isFinite(maxSupply) ||
        !Number.isFinite(mintAmount)
      ) {
        throw new Error("Invalid supply values");
      }

      if (currentTotalSupply + mintAmount > maxSupply) {
        throw new Error(
          `Minting ${amount} would exceed max supply of ${maxSupply}. Current supply: ${currentTotalSupply}`
        );
      }
    }
  } catch (error) {
    // If max supply check fails (e.g., vault not set up), log warning but proceed
    // On-chain enforcement will still prevent exceeding max supply
    const errorMsg = (error as Error).message;
    if (errorMsg.includes("would exceed max supply")) {
      // Re-throw explicit max supply errors
      throw error;
    }
    // For other errors (query failures, etc.), log and proceed
    // The on-chain pre-condition will still enforce max supply
    console.warn(
      `Could not verify max supply before minting for vault ${vaultId}:`,
      errorMsg
    );
  }

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([fcl.arg(vaultId, fcl.t.String), fcl.arg(amount, fcl.t.UFix64)]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  await fcl.tx(txId as string).onceSealed();
  return { txId: txId as string };
}

export async function txTransferShares(input: {
  vaultId: string;
  recipient: string;
  amount: string;
}): Promise<{ txId: string }> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const recipient = with0x(input.recipient);
  const amount = ensureDecimal(input.amount, "amount");
  if (!vaultId || !recipient) throw new Error("vaultId and recipient required");

  const meta = await fetchShareMetadata(vaultId);
  let cadence = getCadence("transactions/shares/admin/transfer_dynamic.cdc");
  cadence = aliasVaultShareImport(
    cadence,
    meta.contractName,
    meta.contractAddress
  );

  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(recipient, fcl.t.Address),
        fcl.arg(amount, fcl.t.UFix64),
        fcl.arg(meta.storagePath, fcl.t.String),
        fcl.arg(meta.receiverPath, fcl.t.String),
      ]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  await fcl.tx(txId as string).onceSealed();
  return { txId: txId as string };
}

// Prepare a user-signed setup transaction for the per-vault share token
export async function prepareSetupShareVaultTx(input: {
  vaultId: string;
}): Promise<{
  cadence: string;
  args: Array<{ type: string; value: string }>;
  limit: number;
}> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  if (!vaultId) throw new Error("vaultId required");
  const meta = await fetchShareMetadata(vaultId);
  let cadence = getCadence("transactions/shares/user/setup_dynamic.cdc");
  cadence = aliasVaultShareImport(
    cadence,
    meta.contractName,
    meta.contractAddress
  );
  return { cadence, args: [], limit: 9999 };
}

// (burn helper removed; not part of original extraction scope)

export async function txConfigureShareSupply(input: {
  vaultId: string;
  maxSupply?: string | null;
  escrowAmount?: string | null;
  escrowRecipient?: string | null;
}): Promise<{ maxSupplyTxId?: string | null; mintTxId?: string | null }> {
  const vaultId = input.vaultId.trim();
  if (!vaultId) throw new Error("vaultId required");

  // Important: Escrow recipient is always admin
  const recipient = input.escrowRecipient
    ? with0x(input.escrowRecipient)
    : with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);

  // If we're going to mint into escrow, ensure admin escrow vault and
  // public caps exist for the concrete FT. For maxSupply-only, this is not needed.
  const wantsMint = !!(input.escrowAmount && Number(input.escrowAmount) > 0);
  if (wantsMint) {
    let meta: ShareMetadata | null = null;
    try {
      meta = await fetchShareMetadata(vaultId);
    } catch {
      const cadence = getCadence("scripts/GetVaultShareSymbol.cdc");
      const symbol = (await fcl.query({
        cadence,
        args: (arg, t) => [arg(vaultId, t.String)],
      })) as string;
      const { txAutosetupVaultFT } = await import("./vaults");
      const contractName = `VaultShareToken_${symbol.replace(
        /[^A-Za-z0-9_]/g,
        "_"
      )}`;
      try {
        await txAutosetupVaultFT({
          vaultId,
          contractName,
          name: `Vault ${vaultId} Share Token`,
          symbol,
          decimals: 8,
          maxSupply: null,
        });
      } catch (e) {
        throw new Error(
          `share token autosetup failed: ${(e as Error).message}`
        );
      }
      meta = await fetchShareMetadata(vaultId);
    }
    if (!meta) {
      throw new Error("failed to initialize share token metadata");
    }
    await txEnsureAdminCapsInternal(meta);
  }

  let maxSupplyTxId: string | null = null;
  if (input.maxSupply && Number(input.maxSupply) > 0) {
    const { txId } = await txSetShareMaxSupply({
      vaultId,
      maxSupply: input.maxSupply,
    });
    maxSupplyTxId = txId;
  }

  let mintTxId: string | null = null;
  if (wantsMint) {
    const { txId } = await txMintShares({
      vaultId,
      recipient,
      amount: input.escrowAmount || "0.0",
    });
    mintTxId = txId;
  }

  return { maxSupplyTxId, mintTxId };
}

export async function scriptShareBalance(input: {
  vaultId: string;
  account: string;
}): Promise<string> {
  setAccessNode();
  const vaultId = input.vaultId.trim();
  const account = with0x(input.account);
  if (!vaultId || !account) throw new Error("vaultId and account required");

  let meta: ShareMetadata;
  try {
    meta = await fetchShareMetadata(vaultId);
  } catch {
    // If share token metadata isn't registered yet for this vault,
    // treat balance as zero for read paths.
    return "0.0";
  }
  const result = await fcl.query({
    cadence: getCadence("scripts/GetShareBalanceByPath.cdc"),
    args: (arg, t) => [
      arg(account, t.Address),
      arg(meta.balancePath, t.String),
    ],
  });
  return String(result ?? "0.0");
}

export async function scriptVaultMaxSupply(
  vaultId: string
): Promise<string | null> {
  setAccessNode();
  const code = getCadence("scripts/GetVaultMaxSupply.cdc");
  const result = (await fcl.query({
    cadence: code,
    args: (arg, t) => [arg(vaultId, t.String)],
  })) as string | null | undefined;
  return result ?? null;
}

export async function scriptVaultTotalSupply(
  vaultId: string
): Promise<string | null> {
  setAccessNode();
  const meta = await fetchShareMetadata(vaultId);
  let code = getCadence("scripts/GetVaultTotalSupply.cdc");
  code = aliasVaultShareImport(code, meta.contractName, meta.contractAddress);

  try {
    const result = (await fcl.query({ cadence: code, args: () => [] })) as
      | string
      | number
      | null;
    return result != null ? String(result) : null;
  } catch (error) {
    // If FT metadata is not set up yet, return null
    console.warn(`Failed to fetch total supply for vault ${vaultId}:`, error);
    return null;
  }
}
