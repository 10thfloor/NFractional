import { files } from "@flow-hackathon/cadence";

/**
 * Return the GetWalletBalances script with imports aliased to concrete addresses
 * via our API-sourced address registry. Ensures compatibility across networks.
 */
export async function getWalletBalancesScriptAliased(): Promise<string> {
  const base = files["scripts/GetWalletBalances.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

/** Return the VaultCustodyStatus script with imports aliased */
export async function getVaultCustodyStatusScriptAliased(): Promise<string> {
  const base = files["scripts/VaultCustodyStatus.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}
