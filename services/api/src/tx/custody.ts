import * as fcl from "@onflow/fcl";
// Source-of-truth: see matching Cadence files under flow/cadence/transactions/custody/user
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

export async function txSetupCustody() {
  setAccessNode();
  const code = getCadence("transactions/custody/user/PublishCustodyCap.cdc");
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
  return { txId };
}
