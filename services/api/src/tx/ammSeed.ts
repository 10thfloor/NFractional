import * as fcl from "@onflow/fcl";

import ENV from "../lib/env";
import with0x from "../lib/addr";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { getCadence } from "../lib/cadence";

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

export async function txSeedLiquidity(input: {
  vaultId: string;
  poolOwner: string;
  poolId: string;
  shareAmount: string;
  flowAmount: string;
  minLpOut: string;
}): Promise<string> {
  setAccessNode();

  const vaultId = input.vaultId.trim();
  const poolOwner = with0x(input.poolOwner);
  const poolId = input.poolId.trim();
  const shareAmount = ensureDecimal(input.shareAmount, "shareAmount");
  const flowAmount = ensureDecimal(input.flowAmount, "flowAmount");
  const minLpOut = ensureDecimal(input.minLpOut, "minLpOut");

  if (!vaultId || !poolOwner || !poolId) {
    throw new Error("vaultId, poolOwner and poolId are required");
  }

  const cadence = getCadence("transactions/pools/admin/SeedLiquidity.cdc");

  const { proposer, payer, authorizations } = getLocalAuthTriplet(
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS),
    with0x(ENV.FRACTIONAL_PLATFORM_ADMIN_KEY)
  );

  const txId = await fcl
    .send([
      fcl.transaction(cadence),
      fcl.args([
        fcl.arg(poolOwner, fcl.t.Address),
        fcl.arg(poolId, fcl.t.String),
        fcl.arg(vaultId, fcl.t.String),
        fcl.arg(shareAmount, fcl.t.UFix64),
        fcl.arg(flowAmount, fcl.t.UFix64),
        fcl.arg(minLpOut, fcl.t.UFix64),
      ]),
      fcl.proposer(proposer),
      fcl.payer(payer),
      fcl.authorizations(authorizations),
      fcl.limit(9999),
    ])
    .then(fcl.decode);

  return txId as string;
}
