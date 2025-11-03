import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_FLOW_NETWORK || "emulator";

export async function POST(request: NextRequest) {
  try {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      return NextResponse.json(
        { error: "Admin backend not configured; contact operator" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { vaultId, maxSupply, escrowAmount, escrowRecipient } = body;

    if (!vaultId || typeof vaultId !== "string") {
      return NextResponse.json(
        { error: "vaultId is required" },
        { status: 400 }
      );
    }

    const mutation = `
      mutation ConfigureShareSupply(
        $network: String!
        $vaultId: String!
        $maxSupply: String
        $escrowAmount: String
        $escrowRecipient: String
      ) {
        configureShareSupply(
          network: $network
          vaultId: $vaultId
          maxSupply: $maxSupply
          escrowAmount: $escrowAmount
          escrowRecipient: $escrowRecipient
        ) {
          maxSupplyTxId
          mintTxId
        }
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
          maxSupply: maxSupply || null,
          escrowAmount: escrowAmount || null,
          escrowRecipient: escrowRecipient || null,
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
      const msg = json.errors.map((e: { message: string }) => e.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!json.data?.configureShareSupply) {
      return NextResponse.json(
        { error: "GraphQL empty response" },
        { status: 500 }
      );
    }

    return NextResponse.json(json.data.configureShareSupply);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

