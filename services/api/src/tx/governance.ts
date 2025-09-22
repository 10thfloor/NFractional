import * as fcl from "@onflow/fcl";
import t from "@onflow/types";
import ENV from "../lib/env";
import with0x, { aliasVaultShareImport } from "../lib/addr";
import { getLocalAuthTriplet } from "../lib/flowAuth";
import { getCadence } from "../lib/cadence";
import { fetchShareMetadata } from "./shares";

function setAccessNode() {
  const accessUrl = ENV.FLOW_ACCESS.startsWith("http")
    ? ENV.FLOW_ACCESS
    : `http://${ENV.FLOW_ACCESS}`;
  fcl.config().put("accessNode.api", accessUrl);
}

export async function txSetTransferMode(input: {
  symbol: string;
  mode: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/shares/admin/set-transfer-mode.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.symbol, t.String),
        fcl.arg(input.mode, t.String),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txProposeBuyout(input: {
  vaultId: string;
  proposalId: string;
  asset: string;
  amount: string;
  quorumPercent: number;
  supportPercent: number;
  expiresAt: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/governance/admin/buyout-propose.cdc");
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
        fcl.arg(input.proposalId, t.String),
        fcl.arg(input.asset, t.String),
        fcl.arg(input.amount, t.UFix64),
        fcl.arg(String(input.quorumPercent), t.UInt64),
        fcl.arg(String(input.supportPercent), t.UInt64),
        fcl.arg(input.expiresAt, t.UInt64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txVoteBuyout(input: {
  vaultId: string;
  proposalId: string;
  forVotes: string;
  againstVotes: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/governance/admin/buyout-vote.cdc");
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
        fcl.arg(input.proposalId, t.String),
        fcl.arg(input.forVotes, t.UFix64),
        fcl.arg(input.againstVotes, t.UFix64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txFinalizeBuyout(input: {
  vaultId: string;
  proposalId: string;
  result: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/governance/admin/buyout-finalize.cdc");
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
        fcl.arg(input.proposalId, t.String),
        fcl.arg(input.result, t.String),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txScheduleDistribution(input: {
  vaultId: string;
  programId: string;
  asset: string;
  totalAmount: string;
  schedule: string;
  startsAt: string;
  endsAt: string;
}) {
  setAccessNode();
  
  // Fetch share metadata to alias VaultShareToken import
  const shareMeta = await fetchShareMetadata(input.vaultId);
  
  // Get Cadence code and alias VaultShareToken import
  let code = getCadence("transactions/distributions/admin/schedule.cdc");
  code = aliasVaultShareImport(
    code,
    shareMeta.contractName,
    shareMeta.contractAddress
  );
  
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
        fcl.arg(input.programId, t.String),
        fcl.arg(input.asset, t.String),
        fcl.arg(input.totalAmount, t.UFix64),
        fcl.arg(input.schedule, t.String),
        fcl.arg(input.startsAt, t.UInt64),
        fcl.arg(input.endsAt, t.UInt64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txClaimPayout(input: {
  programId: string;
  amount: string;
}) {
  setAccessNode();
  const code = getCadence("transactions/distributions/user/claim.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([
        fcl.arg(input.programId, t.String),
        fcl.arg(input.amount, t.UFix64),
      ]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}

export async function txRedeem(input: { vaultId: string }) {
  setAccessNode();
  const code = getCadence("transactions/vault/admin/redeem.cdc");
  const { proposer } = getLocalAuthTriplet(
    ENV.FRACTIONAL_PLATFORM_ADMIN_ADDRESS,
    ENV.FRACTIONAL_PLATFORM_ADMIN_KEY,
    0
  );
  const txId = await fcl
    .send([
      fcl.transaction(code),
      fcl.args([fcl.arg(input.vaultId, t.String)]),
      fcl.proposer(proposer as any),
      fcl.payer(proposer as any),
      fcl.authorizations([proposer] as any),
      fcl.limit(9999),
    ])
    .then(fcl.decode);
  return { txId };
}
