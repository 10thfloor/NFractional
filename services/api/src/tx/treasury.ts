import * as fcl from "@onflow/fcl";
import t from "@onflow/types";
import ENV from "../lib/env";
import { getCadence } from "../lib/cadence";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { aliasVaultShareImport, with0x } from "../lib/addr";

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

export async function txEnsureTreasuriesDynamic(input: {
  tokenIdent: string; // e.g., share FT contract name or "FLOW"
  vaultId?: string | null; // optional: per-vault treasury
  contractName?: string | null; // optional: contract name for aliasing (only needed for non-FLOW)
  contractAddress?: string | null; // optional: contract address for aliasing (only needed for non-FLOW)
}): Promise<string> {
  setAccessNode();

  let code = getCadence(
    "transactions/treasury/admin/ensure_treasuries_dynamic.cdc"
  );

  // Only alias VaultShareToken import for non-FLOW tokens
  // For FLOW, we still need to resolve the import but can use a placeholder
  if (input.tokenIdent !== "FLOW") {
    if (!input.contractName || !input.contractAddress) {
      throw new Error(
        `Contract name and address are required for share token ${input.tokenIdent}`
      );
    }
    const formattedAddr = with0x(input.contractAddress);
    code = aliasVaultShareImport(code, input.contractName, formattedAddr);
  } else {
    // For FLOW transactions, use a placeholder contract address
    // The import exists but won't be used in the FLOW branch
    // Use the emulator address where VaultShareToken is deployed (or Fractional contract address as fallback)
    const placeholderAddress =
      ENV.FLOW_CONTRACT_FRACTIONAL || "f8d6e0586b0a20c7";
    const placeholderName = "VaultShareToken"; // Generic placeholder
    code = aliasVaultShareImport(
      code,
      placeholderName,
      with0x(placeholderAddress)
    );
  }

  // Verify alias was applied
  const aliasApplied =
    code.includes("import ") && code.includes("as VaultShareToken");
  if (!aliasApplied) {
    throw new Error("Failed to alias VaultShareToken import");
  }

  // Final verification
  const hasUnresolvedImport = /import\s+["']VaultShareToken["']/.test(code);
  if (hasUnresolvedImport) {
    throw new Error("VaultShareToken import not handled before sending");
  }

  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );

  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.tokenIdent, t.String),
        fcl.arg(input.vaultId ?? null, t.Optional(t.String)),
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

// Orchestrate readiness for a vault's treasuries and admin caps (idempotent)
export async function txEnsureVaultReady(input: {
  vaultId: string;
  shareTokenIdent: string; // REQUIRED: contract name (e.g., "VaultShareToken_V002")
  shareTokenAddress: string; // REQUIRED: contract address
}): Promise<{ flowTreasuryTxId: string; shareTreasuryTxId: string }> {
  const { vaultId, shareTokenIdent, shareTokenAddress } = input;

  // Ensure per‑vault share treasuries
  const shareTreasuryTxId = await txEnsureTreasuriesDynamic({
    tokenIdent: shareTokenIdent,
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

  // Ensure per‑vault FLOW treasuries (FLOW doesn't need contract metadata for aliasing)
  const flowTreasuryTxId = await txEnsureTreasuriesDynamic({
    tokenIdent: "FLOW",
    vaultId,
    // FLOW transactions use a placeholder contract address since VaultShareToken isn't used
  });

  return { flowTreasuryTxId, shareTreasuryTxId };
}
