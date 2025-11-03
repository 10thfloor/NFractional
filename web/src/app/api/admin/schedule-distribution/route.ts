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
    const {
      vaultId,
      programId,
      asset,
      totalAmount,
      schedule,
      startsAt,
      endsAt,
    } = body;

    if (!vaultId || typeof vaultId !== "string") {
      return NextResponse.json(
        { error: "vaultId is required" },
        { status: 400 }
      );
    }

    if (!programId || typeof programId !== "string") {
      return NextResponse.json(
        { error: "programId is required" },
        { status: 400 }
      );
    }

    if (!asset || typeof asset !== "string") {
      return NextResponse.json(
        { error: "asset is required" },
        { status: 400 }
      );
    }

    if (!totalAmount || typeof totalAmount !== "string") {
      return NextResponse.json(
        { error: "totalAmount is required" },
        { status: 400 }
      );
    }

    if (!schedule || typeof schedule !== "string") {
      return NextResponse.json(
        { error: "schedule is required" },
        { status: 400 }
      );
    }

    if (!startsAt || typeof startsAt !== "string") {
      return NextResponse.json(
        { error: "startsAt is required" },
        { status: 400 }
      );
    }

    if (!endsAt || typeof endsAt !== "string") {
      return NextResponse.json(
        { error: "endsAt is required" },
        { status: 400 }
      );
    }

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
      headers: {
        "Content-Type": "application/json",
        "x-admin-auth": adminKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          network: DEFAULT_NETWORK,
          vaultId,
          programId,
          asset,
          totalAmount,
          schedule,
          startsAt,
          endsAt,
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

    if (!json.data?.scheduleDistribution) {
      return NextResponse.json(
        { error: "GraphQL empty response" },
        { status: 500 }
      );
    }

    return NextResponse.json(json.data.scheduleDistribution);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

