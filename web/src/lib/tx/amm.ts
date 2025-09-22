import { files } from "@flow-hackathon/cadence";
import type { CadenceAddrsStd } from "@/lib/flow";
import {
  aliasVaultShareImport,
  tempAddImports,
  normalizeFlowAddress,
} from "@/lib/cadence";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const swapViaActionsTx = (_addrs: CadenceAddrsStd): string =>
  files["transactions/pools/user/SwapViaActions.cdc"];

async function withShareAlias(
  cadence: string,
  vaultId: string,
  apiBase?: string
): Promise<string> {
  const base = (
    apiBase ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/graphql"
  ).replace(/\/graphql$/, "");
  const r = await fetch(`${base}/vaults/${encodeURIComponent(vaultId)}/ft`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ft registry fetch failed: ${r.status}`);
  const j = (await r.json()) as { ft?: { address?: string; name?: string } };
  const addr = normalizeFlowAddress(j?.ft?.address || "");
  const name = String(j?.ft?.name || "");
  if (!addr || !name)
    throw new Error("missing per‑vault FT registry for aliasing");
  let out = aliasVaultShareImport(cadence, name, addr);
  out = await tempAddImports(out, base);
  return out;
}

export const createPoolTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/CreatePool.cdc"],
    vaultId
  );

export const addLiquidityTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/AddLiquidity.cdc"],
    vaultId
  );

export const addLiquidityOptimalTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/AddLiquidityOptimal.cdc"],
    vaultId
  );

export const zapAddLiquidityTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/ZapAddLiquidityViaActions.cdc"],
    vaultId
  );

export const removeLiquidityTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/RemoveLiquidity.cdc"],
    vaultId
  );

export const swapViaActionsTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/SwapViaActions.cdc"],
    vaultId
  );

export const addLiquidityWithChangeTxAliased = async (
  vaultId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _addrs?: CadenceAddrsStd
): Promise<string> =>
  await withShareAlias(
    files["transactions/pools/user/AddLiquidityWithChange.cdc"],
    vaultId
  );
