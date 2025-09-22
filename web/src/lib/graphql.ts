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

export const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_NETWORK || "emulator";
