import type { FlowAuthorizationFn } from "@/lib/flow";

type CreateVaultFromNFTDualInput = {
  vaultId: string;
  collectionStoragePath: string;
  collectionPublicPath: string;
  tokenId: string; // UInt64 string
  shareSymbol: string;
  policy: string;
  creatorAuth: FlowAuthorizationFn; // current user (NFT owner)
  adminAuth: FlowAuthorizationFn; // platform admin
};

import { files } from "@flow-hackathon/cadence";
import {
  aliasVaultShareImport,
  normalizeFlowAddress,
  ensureUFix64String,
} from "@/lib/cadence";

export function createVaultFromNFTDualTxConfig(
  input: CreateVaultFromNFTDualInput
) {
  // Dual-authorizer (creator + admin) transaction to match provided authorizations
  const cadence = files["transactions/vault/user/submit-from-collection.cdc"];

  return {
    cadence,
    args: (arg: any, t: any) => [
      arg(input.vaultId, t.String),
      arg(input.collectionStoragePath, t.String),
      arg(input.collectionPublicPath, t.String),
      arg(Number(input.tokenId), t.UInt64),
      arg(input.shareSymbol, t.String),
      arg(input.policy, t.String),
    ],
    authorizations: [input.creatorAuth as any, input.adminAuth as any],
    limit: 9999,
  };
}

type CreateVaultAndMintDualInput = CreateVaultFromNFTDualInput & {
  maxSupply?: string | null; // UFix64 string
  initialMint: string; // UFix64 string
};

export async function createVaultAndMintDualTxConfig(
  input: CreateVaultAndMintDualInput
) {
  const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql"
  ).replace(/\/graphql$/, "");

  // Build concrete per-series FT contract name consistent with server sanitization
  const baseName = `VaultShareToken_${input.shareSymbol.replace(
    /[^A-Za-z0-9_]/g,
    "_"
  )}`;
  const ftContractName = baseName.replace(/^[0-9]/, (m) => `C_${m}`);

  // Ensure the concrete FT contract is deployed (idempotent) and wait for completion
  const deployResp = await fetch(`${API_BASE}/contracts/series-ft-deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractName: ftContractName,
      name: `Vault ${input.vaultId} Share Token`,
      symbol: input.shareSymbol,
      decimals: 8,
      maxSupply: null,
    }),
  });
  if (!deployResp.ok) {
    throw new Error(`FT deployment failed: ${deployResp.status}`);
  }
  const deployResult = (await deployResp.json()) as {
    txId?: string;
    error?: string;
  };
  if (deployResult.error) {
    throw new Error(`FT deployment error: ${deployResult.error}`);
  }
  if (!deployResult.txId) {
    throw new Error("FT deployment succeeded but txId not returned");
  }

  // Get platform admin address (where all contracts are deployed on testnet)
  const addrsResp = await fetch(`${API_BASE}/flow/addresses`, {
    cache: "no-store",
  });
  if (!addrsResp.ok) {
    throw new Error(`addresses fetch failed: ${addrsResp.status}`);
  }
  const addrs = (await addrsResp.json()) as { platformAdmin?: string };
  const ftAddress = normalizeFlowAddress(addrs.platformAdmin || "");
  if (!ftAddress) {
    throw new Error("platform admin address missing");
  }

  const { files } = await import("@flow-hackathon/cadence");
  let cadence: string = files[
    "transactions/vault/user/submit-and-mint_dynamic.cdc"
  ] as string;

  // First rewrite other imports, then alias VaultShareToken (order matters!)
  cadence = await (
    await import("@/lib/cadence")
  ).tempAddImports(cadence, API_BASE);
  cadence = aliasVaultShareImport(cadence, ftContractName, ftAddress);

  return {
    cadence,
    args: (arg: any, t: any) => [
      arg(input.vaultId, t.String),
      arg(input.collectionStoragePath, t.String),
      arg(input.collectionPublicPath, t.String),
      arg(Number(input.tokenId), t.UInt64),
      arg(input.shareSymbol, t.String),
      arg(input.policy, t.String),
      arg(
        input.maxSupply ? ensureUFix64String(input.maxSupply) : null,
        t.Optional(t.UFix64)
      ),
      arg(ensureUFix64String(input.initialMint), t.UFix64),
      // set_ft params
      arg(ftAddress, t.Address),
      arg(ftContractName, t.String),
      arg(`vault_${input.shareSymbol}`, t.String),
      arg(`receiver_${input.shareSymbol}`, t.String),
      arg(`balance_${input.shareSymbol}`, t.String),
    ],
    authorizations: [input.creatorAuth as any, input.adminAuth as any],
    limit: 9999,
  };
}
