const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";

export type Distribution = {
  network: string;
  vaultId: string;
  programId: string;
  asset: string;
  totalAmount: string;
  schedule: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
};

export type DistributionRecipient = {
  account: string;
  amount: string;
  createdAt?: string | null;
};

export type Claim = {
  network: string;
  programId: string;
  account: string;
  amount: string;
  claimedAt: string | null;
};

export async function listDistributions(
  vaultId: string
): Promise<Distribution[]> {
  const query = `
    query ListDistributions($network: String!, $vaultId: String!) {
      distributions(network: $network, vaultId: $vaultId, limit: 50) {
        network
        vaultId
        programId
        asset
        totalAmount
        schedule
        startsAt
        endsAt
        createdAt
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        network: DEFAULT_NETWORK,
        vaultId,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch distributions: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }

  return json.data?.distributions || [];
}

export async function getDistributionRecipients(
  programId: string
): Promise<DistributionRecipient[]> {
  const query = `
    query GetDistributionRecipients($network: String!, $programId: String!) {
      distributionRecipients(network: $network, programId: $programId) {
        account
        amount
        createdAt
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        network: DEFAULT_NETWORK,
        programId,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch recipients: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }

  return json.data?.distributionRecipients || [];
}

export async function listClaims(
  programId: string
): Promise<Claim[]> {
  const query = `
    query ListClaims($network: String!, $programId: String!) {
      claims(network: $network, programId: $programId, limit: 100) {
        network
        programId
        account
        amount
        claimedAt
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        network: DEFAULT_NETWORK,
        programId,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch claims: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }

  return json.data?.claims || [];
}

export async function scheduleDistribution(input: {
  vaultId: string;
  programId: string;
  asset: string;
  totalAmount: string;
  schedule: string;
  startsAt: string;
  endsAt: string;
}): Promise<{ txId: string }> {
  const mutation = `
    mutation ScheduleDistribution(
      $network: String!
      $vaultId: String!
      $programId: String!
      $asset: String!
      $totalAmount: String!
      $schedule: String!
      $startsAt: String!
      $endsAt: String!
    ) {
      scheduleDistribution(
        network: $network
        vaultId: $vaultId
        programId: $programId
        asset: $asset
        totalAmount: $totalAmount
        schedule: $schedule
        startsAt: $startsAt
        endsAt: $endsAt
      ) {
        txId
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: mutation,
      variables: {
        network: DEFAULT_NETWORK,
        ...input,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to schedule distribution: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }

  return json.data?.scheduleDistribution || { txId: "" };
}

export async function claimPayout(input: {
  programId: string;
  amount: string;
}): Promise<{ txId: string }> {
  const mutation = `
    mutation ClaimPayout($network: String!, $programId: String!, $amount: String!) {
      claimPayout(network: $network, programId: $programId, amount: $amount) {
        txId
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: mutation,
      variables: {
        network: DEFAULT_NETWORK,
        ...input,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to claim payout: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }

  return json.data?.claimPayout || { txId: "" };
}

