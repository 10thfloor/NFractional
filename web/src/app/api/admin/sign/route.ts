import { NextRequest, NextResponse } from "next/server";
import { consumeNonce } from "@/lib/kvNonce";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const FLOW_ADMIN_SIGN_SECRET = process.env.FLOW_ADMIN_SIGN_SECRET;

type Body = {
  signable: unknown;
  challenge: string;
  signatures: Array<{
    addr: string;
    keyId: number;
    signature: string;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    if (!FLOW_ADMIN_SIGN_SECRET && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin sign secret not configured" },
        { status: 500 }
      );
    }

    const cookieNonce = request.cookies.get("admin_sign_nonce")?.value || "";
    const { signable, challenge, signatures } = (await request.json()) as Body;

    if (!signable || !challenge || !Array.isArray(signatures)) {
      return NextResponse.json(
        { error: "signable, challenge, and signatures required" },
        { status: 400 }
      );
    }

    let parsed: { purpose?: string; exp?: number; nonce?: string } = {};
    try {
      parsed = JSON.parse(challenge) as typeof parsed;
    } catch {
      return NextResponse.json(
        { error: "Invalid challenge format" },
        { status: 400 }
      );
    }

    if (parsed.purpose !== "admin-sign") {
      return NextResponse.json(
        { error: "Invalid challenge purpose" },
        { status: 400 }
      );
    }
    if (!parsed.exp || Date.now() > parsed.exp) {
      return NextResponse.json(
        { error: "Challenge expired" },
        { status: 401 }
      );
    }
    if (!parsed.nonce || parsed.nonce !== cookieNonce) {
      return NextResponse.json(
        { error: "Nonce mismatch" },
        { status: 401 }
      );
    }

    // Ensure nonce exists and consume it (single-use)
    try {
      const ok = await consumeNonce(parsed.nonce);
      if (!ok) {
        return NextResponse.json(
          { error: "Nonce invalid or already used" },
          { status: 401 }
        );
      }
    } catch (_e) {
      // If KV not available, proceed (in dev) relying on cookie nonce only
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Nonce store unavailable" },
          { status: 500 }
        );
      }
    }

    const authKeyId = (signable as { auth?: { keyId?: number } })?.auth?.keyId ?? 0;
    if (authKeyId !== 0) {
      return NextResponse.json(
        { error: "Invalid admin keyId (must be 0)" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (FLOW_ADMIN_SIGN_SECRET) {
      headers.Authorization = `Bearer ${FLOW_ADMIN_SIGN_SECRET}`;
    }

    const resp = await fetch(`${API_BASE}/flow/admin-sign`, {
      method: "POST",
      headers,
      body: JSON.stringify({ signable, challenge, signatures }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: errText || `HTTP ${resp.status}` },
        { status: resp.status }
      );
    }

    const payload = await resp.json();
    const res = NextResponse.json(payload);
    // Single-use nonce: clear cookie
    res.cookies.set("admin_sign_nonce", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Internal error" },
      { status: 500 }
    );
  }
}


