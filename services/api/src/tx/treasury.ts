import * as fcl from "@onflow/fcl";
import t from "@onflow/types";
import ENV from "../lib/env";
import { getCadence } from "../lib/cadence";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { aliasVaultShareImport, with0x } from "../lib/addr";
import { toSafePathIdentifier } from "../lib/ident";

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

export async function txEnsureShareTreasuries(input: {
  vaultId?: string | null;
  contractName: string; // concrete per‑vault FT name
  contractAddress: string; // 0x-prefixed address
}): Promise<string> {
  setAccessNode();
  if (!input.contractName || !input.contractAddress) {
    throw new Error(
      "contractName and contractAddress are required for share treasuries"
    );
  }
  if (input.contractName === "VaultShareToken") {
    throw new Error(
      "Invalid alias: contractName must not be 'VaultShareToken'"
    );
  }
  let code = getCadence(
    "transactions/treasury/admin/ensure_share_treasuries.cdc"
  );
  const formattedAddr = with0x(input.contractAddress);
  code = aliasVaultShareImport(code, input.contractName, formattedAddr);
  const expectedAlias = `import ${input.contractName} as VaultShareToken from ${formattedAddr}`;
  if (
    !code.includes(expectedAlias) ||
    /import\s+["']VaultShareToken["']/.test(code)
  ) {
    throw new Error(
      "Alias failed for VaultShareToken in ensure_share_treasuries"
    );
  }
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const rawSuffix = input.vaultId ? toSafePathIdentifier(input.vaultId) : null;
  const suffix = rawSuffix && rawSuffix.length > 0 ? rawSuffix : "P_id";

  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.contractName, t.String),
        fcl.arg(suffix ?? null, t.Optional(t.String)),
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

export async function txEnsureFlowTreasuries(input: {
  vaultId?: string | null;
}): Promise<string> {
  setAccessNode();
  const code = getCadence(
    "transactions/treasury/admin/ensure_flow_treasuries.cdc"
  );
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const rawSuffix2 = input.vaultId ? toSafePathIdentifier(input.vaultId) : null;
  const suffix = rawSuffix2 && rawSuffix2.length > 0 ? rawSuffix2 : "P_id";

  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([fcl.arg(suffix ?? null, t.Optional(t.String))]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  await fcl.tx(txId as string).onceSealed();
  return txId as string;
}

// Orchestrate readiness for a vault's treasuries and admin caps (idempotent)
export async function txEnsureVaultReady(input: {
  vaultId: string;
  shareTokenIdent: string; // REQUIRED: contract name (e.g., "VaultShareToken_V002")
  shareTokenAddress: string; // REQUIRED: contract address
}): Promise<{ flowTreasuryTxId: string; shareTreasuryTxId: string }> {
  const { vaultId, shareTokenIdent, shareTokenAddress } = input;

  // Ensure per‑vault share treasuries (strict alias)
  const shareTreasuryTxId = await txEnsureShareTreasuries({
    vaultId,
    contractName: shareTokenIdent,
    contractAddress: shareTokenAddress,
  });

  // Wait for transaction to be EXECUTED (not just sealed) to ensure account state is updated
  // This ensures the sequence number has been incremented before the next transaction
  let txStatus: { status: number };
  do {
    txStatus = await fcl.tx(shareTreasuryTxId).snapshot();
    if (txStatus.status === 4) break; // Status 4 = EXECUTED
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (txStatus.status < 4 && txStatus.status !== 5); // 5 = EXPIRED

  if (txStatus.status !== 4) {
    throw new Error(
      `First transaction ${shareTreasuryTxId} did not execute successfully. Status: ${txStatus.status}`
    );
  }

  // Ensure per‑vault FLOW treasuries
  const flowTreasuryTxId = await txEnsureFlowTreasuries({ vaultId });

  return { flowTreasuryTxId, shareTreasuryTxId };
}
