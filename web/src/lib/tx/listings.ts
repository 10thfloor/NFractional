// Cadence transaction and script templates for Listings flows

import { files } from "@flow-hackathon/cadence";
import type { ListingsStdAddrs as StdAddrs } from "@/lib/flow";
import { aliasVaultShareImport, normalizeFlowAddress } from "@/lib/cadence";
import { imp } from "@/lib/flow";
import type { ShareTokenMeta } from "@/types/listings";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fillTx = (_addrs: StdAddrs): string =>
  files["transactions/listings/user/fill.cdc"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const swapFillTx = (_addrs: StdAddrs): string =>
  files["transactions/listings/user/swapFill.cdc"];

export const setupSharesTx = (
  meta: ShareTokenMeta | null,
   
  _addrs: Pick<StdAddrs, "ft">
): string => {
  const base = files["transactions/listings/user/setup-shares.cdc"];
  if (!meta || !meta.address || !meta.contractName) return base;
  const addr = normalizeFlowAddress(meta.address);
  const contractName = String(meta.contractName);
  let out = aliasVaultShareImport(base, contractName, addr);
  // Also pin FungibleToken if provided via addresses
  if (_addrs?.ft) {
    const ftLine = imp("FungibleToken", _addrs.ft);
    // Replace string import or existing line
    out = out.replace(/import\s+["']FungibleToken["']/g, ftLine);
    out = out.replace(/^\s*import\s+FungibleToken\s+from\s+.*$/gm, ftLine);
  }
  return out;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const cancelListingTx = (_addrs: StdAddrs): string =>
  files["transactions/listings/user/cancel.cdc"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const expireListingTx = (_addrs: StdAddrs): string =>
  files["transactions/listings/user/expire.cdc"];

export const hasShareSetupScript = (_ftAddr?: string | null): string => {
  const base = files["transactions/listings/user/has-share-setup.cdc"];
  if (!_ftAddr) return base;
  const ftLine = imp("FungibleToken", _ftAddr);
  let out = base.replace(/import\s+["']FungibleToken["']/g, ftLine);
  out = out.replace(/^\s*import\s+FungibleToken\s+from\s+.*$/gm, ftLine);
  return out;
};

// Async builders that pin all core imports via tempAddImports
export async function fillTxAliased(): Promise<string> {
  const base = files["transactions/listings/user/fill.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

export async function swapFillTxAliased(): Promise<string> {
  const base = files["transactions/listings/user/swapFill.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

export async function cancelListingTxAliased(): Promise<string> {
  const base = files["transactions/listings/user/cancel.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

export async function expireListingTxAliased(): Promise<string> {
  const base = files["transactions/listings/user/expire.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

export async function setupSharesTxAliased(
  meta: ShareTokenMeta | null,
   
  _addrs: Pick<StdAddrs, "ft">
): Promise<string> {
  const base = setupSharesTx(meta, _addrs);
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

// New: buyer-only pay tx
export async function payListingTxAliased(): Promise<string> {
  const base = files["transactions/listings/user/pay.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}

// New: admin settlement tx (server-signed typically; provided for tools)
export async function settleFillTxAliased(): Promise<string> {
  const base = files["transactions/listings/admin/settle-fill.cdc"];
  const { tempAddImports } = await import("@/lib/cadence");
  return await tempAddImports(base);
}
