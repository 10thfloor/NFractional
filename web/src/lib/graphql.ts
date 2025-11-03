export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: (string | number)[] }>;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";

export async function gqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error ${res.status}`);
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(msg);
  }
  if (!json.data) throw new Error("GraphQL empty response");
  return json.data;
}

export const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";

export async function qSymbolAvailable(
  network: string,
  symbol: string
): Promise<boolean> {
  const query = `
    query SymbolAvailable($network: String!, $symbol: String!) {
      symbolAvailable(network: $network, symbol: $symbol) { available }
    }
  `;
  const data = await gqlFetch<{ symbolAvailable: { available: boolean } }>(
    query,
    { network, symbol }
  );
  return Boolean(data.symbolAvailable?.available);
}

export async function qVaultIdAvailable(
  network: string,
  vaultId: string
): Promise<boolean> {
  const query = `
    query VaultIdAvailable($network: String!, $vaultId: String!) {
      vaultIdAvailable(network: $network, vaultId: $vaultId) { available }
    }
  `;
  const data = await gqlFetch<{ vaultIdAvailable: { available: boolean } }>(
    query,
    { network, vaultId }
  );
  return Boolean(data.vaultIdAvailable?.available);
}
