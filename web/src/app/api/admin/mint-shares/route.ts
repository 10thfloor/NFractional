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
    const { vaultId, amount, recipient } = body;

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

    // Validate recipient (required for creator validation)
    if (!recipient || typeof recipient !== "string") {
      return NextResponse.json(
        { error: "recipient is required" },
        { status: 400 }
      );
    }

    // Validate creator ownership
    const vault = await getVault(vaultId);
    if (!vault) {
      return NextResponse.json(
        { error: "Vault not found" },
        { status: 404 }
      );
    }

    if (!vault.creator) {
      return NextResponse.json(
        { error: "Vault has no creator" },
        { status: 400 }
      );
    }

    // Normalize addresses for comparison (remove 0x prefix if present)
    const normalizeAddr = (addr: string) =>
      addr.toLowerCase().replace(/^0x/, "");
    const recipientNormalized = normalizeAddr(recipient);
    const creatorNormalized = normalizeAddr(vault.creator);

    if (recipientNormalized !== creatorNormalized) {
      return NextResponse.json(
        { error: "Only the vault creator can mint shares to themselves" },
        { status: 403 }
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
      mutation MintShares($network: String!, $vaultId: String!, $recipient: String!, $amount: String!) {
        mintShares(network: $network, vaultId: $vaultId, recipient: $recipient, amount: $amount) { txId }
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
          recipient,
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

    if (!json.data?.mintShares) {
      return NextResponse.json(
        { error: "GraphQL empty response" },
        { status: 500 }
      );
    }

    return NextResponse.json(json.data.mintShares);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

