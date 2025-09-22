import { type NextRequest, NextResponse } from "next/server";
import { getVault } from "@/lib/api/vault";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_NETWORK || "emulator";

export async function POST(request: NextRequest) {
  try {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { vaultId, amount } = body;

    if (!vaultId || typeof vaultId !== "string") {
      return NextResponse.json(
        { error: "vaultId is required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "string") {
      return NextResponse.json(
        { error: "amount is required" },
        { status: 400 }
      );
    }

    // Validate vault exists
    const vault = await getVault(vaultId);
    if (!vault) {
      return NextResponse.json(
        { error: "Vault not found" },
        { status: 404 }
      );
    }

    // Validate amount format
    if (!/^[0-9]+(?:\.[0-9]+)?$/.test(amount)) {
      return NextResponse.json(
        { error: "Invalid amount format" },
        { status: 400 }
      );
    }

    const mutation = `
      mutation MintSharesToTreasury($network: String!, $vaultId: String!, $amount: String!) {
        mintSharesToTreasury(network: $network, vaultId: $vaultId, amount: $amount) { txId }
      }
    `;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-auth": adminKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          network: DEFAULT_NETWORK,
          vaultId,
          amount,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `GraphQL HTTP error ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      const msg = json.errors
        .map((e: { message: string }) => e.message)
        .join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!json.data?.mintSharesToTreasury) {
      return NextResponse.json(
        { error: "GraphQL empty response" },
        { status: 500 }
      );
    }

    return NextResponse.json(json.data.mintSharesToTreasury);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

