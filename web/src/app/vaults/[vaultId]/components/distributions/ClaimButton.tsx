"use client";

import { useFlowCurrentUser } from "@onflow/react-sdk";
import { useMemo, useState, useEffect, useCallback } from "react";
import { listClaims, claimPayout } from "@/lib/api/distributions";
import type { Claim } from "@/lib/api/distributions";
import Messages from "../Messages";
import { Button } from "@/components/ui/button";

export default function ClaimButton({
  programId,
  vaultSymbol,
}: {
  programId: string;
  vaultSymbol: string;
}) {
  const { user } = useFlowCurrentUser();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userAddr = user?.addr;
  const userReady = Boolean(userAddr);

  // Find user's claimable amount
  const userClaim = useMemo(() => {
    if (!userAddr) return null;
    return claims.find(
      (c) => c.account.toLowerCase() === userAddr.toLowerCase()
    );
  }, [claims, userAddr]);

  const loadClaims = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const data = await listClaims(programId);
      setClaims(data);
    } catch (e) {
      setError((e as Error).message);
      console.error("Failed to load claims", e);
    } finally {
      setLoading(false);
    }
  }, [programId, loading]);

  const handleClaim = async () => {
    if (!userClaim || pending || !userReady) return;

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await claimPayout({
        programId,
        amount: userClaim.amount,
      });
      setSuccess(`Claimed ${userClaim.amount} ${vaultSymbol}!`);
      // Reload claims
      await loadClaims();
    } catch (e) {
      setError((e as Error).message);
      console.error("Claim payout error", e);
    } finally {
      setPending(false);
    }
  };

  // Auto-load claims when component mounts and user is ready
  useEffect(() => {
    if (userReady && programId && !loading && claims.length === 0) {
      loadClaims();
    }
  }, [userReady, programId, loading, claims.length, loadClaims]);

  if (!userReady) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400">
        Connect your wallet to check for claimable payouts.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400">
        Loading claims...
      </div>
    );
  }

  if (!userClaim) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400">
        No claimable payout found for your address.
      </div>
    );
  }

  const alreadyClaimed = Boolean(userClaim.claimedAt);

  return (
    <div className="space-y-3">
      <Messages error={error} success={success} />
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 space-y-3">
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 font-medium">
            Claimable Amount
          </div>
          <div className="text-lg font-semibold text-neutral-100">
            {userClaim.amount} {vaultSymbol}
          </div>
        </div>
        {alreadyClaimed && (
          <div className="text-xs text-gray-500">
            Claimed at:{" "}
            {userClaim.claimedAt
              ? new Date(userClaim.claimedAt).toLocaleString()
              : "Unknown"}
          </div>
        )}
        <Button
          onClick={handleClaim}
          variant="secondary"
          disabled={pending || alreadyClaimed}
          className="w-full"
        >
          {pending
            ? "Claiming..."
            : alreadyClaimed
            ? "Already Claimed"
            : "Claim Payout"}
        </Button>
      </div>
    </div>
  );
}
