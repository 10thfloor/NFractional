import * as fcl from "@onflow/fcl";
import { txEnsureShareTreasuries, txEnsureFlowTreasuries } from "./treasury";
// Source-of-truth: see matching Cadence files under flow/cadence/transactions/vault (admin/user)
import t from "@onflow/types";
import ENV from "../lib/env";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import with0x from "../lib/addr";
import { getCadence } from "../lib/cadence";

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

export async function txDeploySeriesFT(input: {
  contractName: string; // e.g., VaultShareToken_VAULT001
  name: string;
  symbol: string;
  decimals: number;
  maxSupply?: string | null; // UFix64 string or null
}): Promise<{
  address: string;
  name: string;
  paths: { storage: string; receiver: string; balance: string };
  decimals: number;
}> {
  setAccessNode();
  // Sanitize contract name for Cadence identifier usage (letters, digits, underscore; not starting with a digit)
  let safeName = input.contractName.replace(/[^A-Za-z0-9_]/g, "_");
  if (/^[0-9]/.test(safeName)) safeName = `C_${safeName}`;
  // Provide metadata that matches our token's paths.
  // In emulator/dev we assume token already deployed at ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS (admin account) with dynamic name.

  const addr = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  const storage = `vault_${input.symbol}`;
  const receiver = `receiver_${input.symbol}`;
  const balance = `balance_${input.symbol}`;

  if (!addr || !storage || !receiver || !balance) {
    throw new Error(
      "Missing FRACTIONAL_PLATFORM_ADMIN_ADDRESS, storage, receiver, balance"
    );
  }

  return {
    address: addr,
    name: input.contractName,
    paths: { storage, receiver, balance },
    decimals: input.decimals,
  };
}

export async function txDeploySeriesFTContract(input: {
  contractName: string;
  name: string;
  symbol: string;
  decimals: number;
  maxSupply?: string | null;
}): Promise<string> {
  setAccessNode();
  // Load Cadence contract source and rewrite imports from flow.json/ENV
  let code = getCadence("contracts/VaultShareToken.cdc");
  // Rename contract declaration and all internal references to series name
  code = code.replace(
    /contract\s+VaultShareToken\b/g,
    `contract ${input.contractName}`
  );
  code = code.replace(/\bVaultShareToken\b/g, input.contractName);
  // Hex encodes
  const codeHex = Buffer.from(code, "utf8").toString("hex");
  const tx = getCadence(
    "transactions/contracts/admin/add_contract_with_init.cdc"
  );
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(tx),
      fcl.args([
        fcl.arg(input.contractName, t.String),
        fcl.arg(codeHex, t.String),
        fcl.arg(input.name, t.String),
        fcl.arg(input.symbol, t.String),
        fcl.arg(Number(input.decimals), (t as any).UInt8),
        fcl.arg(input.maxSupply ?? null, t.Optional(t.UFix64)),
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

export async function txRegisterVaultFT(input: {
  vaultId: string;
  ftAddress: string;
  ftContractName: string;
  vaultStoragePathIdentifier: string;
  receiverPublicPathIdentifier: string;
  balancePublicPathIdentifier: string;
}): Promise<string> {
  setAccessNode();

  if (
    !input.vaultId ||
    !input.ftAddress ||
    !input.ftContractName ||
    !input.vaultStoragePathIdentifier ||
    !input.receiverPublicPathIdentifier ||
    !input.balancePublicPathIdentifier
  ) {
    throw new Error("Missing input parameters");
  }

  const code = getCadence("transactions/vault/admin/set_ft.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.vaultId, t.String),
        fcl.arg(input.ftAddress, t.Address),
        fcl.arg(input.ftContractName, t.String),
        fcl.arg(input.vaultStoragePathIdentifier, t.String),
        fcl.arg(input.receiverPublicPathIdentifier, t.String),
        fcl.arg(input.balancePublicPathIdentifier, t.String),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  // Wait for transaction to be EXECUTED (not just sealed) to ensure metadata is queryable
  let txStatus: { status: number };
  do {
    txStatus = await fcl.tx(txId as string).snapshot();
    if (txStatus.status === 4) break; // Status 4 = EXECUTED
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (txStatus.status < 4 && txStatus.status !== 5); // 5 = EXPIRED

  if (txStatus.status !== 4) {
    throw new Error(
      `Transaction ${txId} did not execute successfully. Status: ${txStatus.status}`
    );
  }

  return txId as string;
}

export async function txAdminInitSeriesVault(input: {
  contractName: string;
  symbol: string;
}): Promise<string> {
  setAccessNode();
  const cn = input.contractName;
  const addr = with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS);
  let code = getCadence("transactions/vault/admin/init-series-vault.cdc");
  // Alias only the import line: keep usages as VaultShareToken in Cadence body
  code = code.replace(
    /import\s+["']VaultShareToken["']/g,
    `import ${cn} as VaultShareToken from ${addr}`
  );
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  await fcl.tx(txId as string).onceSealed();
  return txId as string;
}

export async function txRegisterVaultFromNFT(input: {
  vaultId: string;
  collectionStoragePath: string;
  collectionPublicPath: string;
  tokenId: string;
  shareSymbol: string;
  policy: string;
  creator: string;
}): Promise<string> {
  setAccessNode();
  const code = getCadence("transactions/vault/admin/create-from-nft.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.vaultId, t.String),
        fcl.arg(input.collectionStoragePath, t.String),
        fcl.arg(input.collectionPublicPath, t.String),
        fcl.arg(input.tokenId, t.UInt64),
        fcl.arg(input.shareSymbol, t.String),
        fcl.arg(input.policy, t.String),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  // Wait for transaction to be EXECUTED (not just sealed) to ensure metadata is queryable
  let txStatus: { status: number };
  do {
    txStatus = await fcl.tx(txId as string).snapshot();
    if (txStatus.status === 4) break; // Status 4 = EXECUTED
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (txStatus.status < 4 && txStatus.status !== 5); // 5 = EXPIRED

  if (txStatus.status !== 4) {
    throw new Error(
      `Transaction ${txId} did not execute successfully. Status: ${txStatus.status}`
    );
  }

  return txId as string;
}

// Deploy/register/init the FT for a newly created vault. Idempotent best-effort.
export async function txAutosetupVaultFT(input: {
  vaultId: string;
  contractName: string; // e.g., VaultShareToken_<vaultId>
  name: string;
  symbol: string;
  decimals?: number;
  maxSupply?: string | null;
}): Promise<{
  deployTxId: string | null;
  registerTxId: string;
  adminInitTxId: string;
  treasuryTxId: string;
  flowTreasuryTxId: string;
}> {
  const decimals = Number(input.decimals ?? 8);
  // 1) Deploy contract (skip if already exists)
  let deployTxId: string | null = null;
  try {
    deployTxId = await txDeploySeriesFTContract({
      contractName: input.contractName,
      name: input.name,
      symbol: input.symbol,
      decimals,
      maxSupply: input.maxSupply ?? null,
    });
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (!/cannot overwrite existing contract/i.test(msg)) {
      throw e;
    }
  }
  // 2) Build metadata and register to vault
  const ft = await txDeploySeriesFT({
    contractName: input.contractName,
    name: input.name,
    symbol: input.symbol,
    decimals,
    maxSupply: input.maxSupply ?? null,
  });

  const registerTxId = await txRegisterVaultFT({
    vaultId: input.vaultId,
    ftAddress: ft.address,
    ftContractName: ft.name,
    vaultStoragePathIdentifier: ft.paths.storage,
    receiverPublicPathIdentifier: ft.paths.receiver,
    balancePublicPathIdentifier: ft.paths.balance,
  });
  // 3) Ensure admin storage vault exists for this token
  const adminInitTxId = await txAdminInitSeriesVault({
    contractName: ft.name,
    symbol: input.symbol,
  });

  const treasuryTxId = await txEnsureShareTreasuries({
    vaultId: input.vaultId,
    contractName: ft.name,
    contractAddress: ft.address,
  });

  // Ensure FLOW treasuries for this vault as well, so AMM fee routing in FLOW succeeds
  // FLOW doesn't need contract metadata - it uses a placeholder
  const flowTreasuryTxId = await txEnsureFlowTreasuries({
    vaultId: input.vaultId,
  });

  return {
    deployTxId,
    registerTxId,
    adminInitTxId,
    treasuryTxId,
    flowTreasuryTxId,
  };
}

export async function txSetVaultMaxSupply(input: {
  vaultId: string;
  maxSupply: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/vault/admin/set-max-supply.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.vaultId, t.String),
        fcl.arg(input.maxSupply, t.UFix64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}
