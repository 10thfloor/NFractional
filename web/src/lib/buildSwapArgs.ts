import { Decimal, formatUFix64 } from "@/lib/num";
import type { FclArgFn, FclType } from "@/lib/types/fcl";

export function buildSwapArgs(input: {
  owner: string;
  poolId: string;
  direction: "share_to_flow" | "flow_to_share" | string;
  amountIn: string | number;
  slippagePct: string | number;
  useID: boolean;
  vaultId: string;
  platformAdmin: string;
  tokenIdent: string;
  vaultStorageSuffix: string;
}) {
  const owner = input.owner?.startsWith("0x")
    ? input.owner
    : `0x${input.owner}`;
  const identifier = `AMM_Pool_${input.poolId}`;
  const amountStr = formatUFix64(
    new Decimal((input.amountIn ?? 0).toString().replace(/,/g, ""))
  );
  const bps = Math.max(
    0,
    Math.min(10000, Math.floor((Number(input.slippagePct) || 0) * 100))
  );
  const platformAdmin = input.platformAdmin?.startsWith("0x")
    ? input.platformAdmin
    : `0x${input.platformAdmin}`;

  return (arg: FclArgFn, t: FclType) => {
    const types = t as {
      Address: unknown;
      String: unknown;
      UFix64: unknown;
      UInt64: unknown;
      Bool: unknown;
    };
    return [
      arg(owner, types.Address),
      arg(identifier, types.String),
      arg(String(input.direction), types.String),
      arg(amountStr, types.UFix64),
      arg(String(bps), types.UInt64),
      arg(Boolean(input.useID), types.Bool),
      arg(input.vaultId, types.String),
      arg(platformAdmin, types.Address),
      arg(input.tokenIdent, types.String),
      arg(input.vaultStorageSuffix, types.String),
    ];
  };
}
