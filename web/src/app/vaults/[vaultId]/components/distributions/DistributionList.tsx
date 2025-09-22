"use client";

import { useMemo, useState, useEffect } from "react";
import {
  listDistributions,
  getDistributionRecipients,
} from "@/lib/api/distributions";
import type {
  Distribution,
  DistributionRecipient,
} from "@/lib/api/distributions";
import ClaimButton from "./ClaimButton";
import { Button } from "@/components/ui/button";

export default function DistributionList({
  vaultId,
  vaultSymbol,
}: {
  vaultId: string;
  vaultSymbol: string;
}) {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipientsMap, setRecipientsMap] = useState<
    Record<string, DistributionRecipient[]>
  >({});
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await listDistributions(vaultId);
        if (!cancelled) {
          setDistributions(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          console.error("Failed to load distributions", e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  const loadRecipients = async (programId: string) => {
    if (recipientsMap[programId]) return;
    try {
      const recipients = await getDistributionRecipients(programId);
      setRecipientsMap((m) => ({ ...m, [programId]: recipients }));
    } catch (e) {
      console.error("Failed to load recipients", e);
    }
  };

  const now = useMemo(() => new Date(), []);
  const sorted = useMemo(() => {
    return [...distributions].sort((a, b) => {
      const aStart = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bStart = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bStart - aStart;
    });
  }, [distributions]);

  const getStatus = (dist: Distribution) => {
    if (!dist.startsAt || !dist.endsAt) return "unknown";
    const start = new Date(dist.startsAt);
    const end = new Date(dist.endsAt);
    if (now < start) return "scheduled";
    if (now >= start && now <= end) return "active";
    return "completed";
  };

  if (loading) {
    return (
      <div className="text-sm text-neutral-400">Loading distributions...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-800/40 bg-red-950/20 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (distributions.length === 0) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-400">
        No distributions scheduled yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((dist) => {
        const status = getStatus(dist);
        const recipients = recipientsMap[dist.programId] || [];
        const isExpanded = expandedProgramId === dist.programId;

        return (
          <div
            key={dist.programId}
            className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold text-neutral-100">
                    {dist.programId}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      status === "scheduled"
                        ? "bg-blue-950/30 text-blue-300 border border-blue-800/40"
                        : status === "active"
                        ? "bg-green-950/30 text-green-300 border border-green-800/40"
                        : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Asset:</span>
                    <span className="text-neutral-100 font-medium">
                      {dist.asset}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Total:</span>
                    <span className="text-neutral-100 font-medium">
                      {dist.totalAmount}
                    </span>
                  </div>
                  {dist.startsAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Starts:</span>
                      <span className="text-neutral-100">
                        {new Date(dist.startsAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {dist.endsAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Ends:</span>
                      <span className="text-neutral-100">
                        {new Date(dist.endsAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {dist.createdAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Created:</span>
                      <span className="text-neutral-100">
                        {new Date(dist.createdAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isExpanded) {
                      loadRecipients(dist.programId);
                      setExpandedProgramId(dist.programId);
                    } else {
                      setExpandedProgramId(null);
                    }
                  }}
                >
                  {isExpanded ? "Hide" : "Show"} Details
                </Button>
              </div>
            </div>
            {isExpanded && (
              <div className="mt-4 space-y-4 pt-4 border-t border-neutral-700">
                {recipients.length > 0 && (
                  <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 space-y-2">
                    <div className="text-sm font-semibold text-neutral-100">
                      Recipients ({recipients.length})
                    </div>
                    <div className="max-h-60 space-y-1 overflow-y-auto text-xs">
                      {recipients.map((r, i) => (
                        <div
                          key={`${r.account}-${i}`}
                          className="flex justify-between items-center py-1.5 border-b border-neutral-800 last:border-0"
                        >
                          <span className="text-gray-400 font-mono text-[11px]">
                            {r.account}
                          </span>
                          <span className="text-neutral-100 font-semibold">
                            {r.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {recipients.length === 0 && (
                  <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3">
                    <div className="text-sm text-gray-500">
                      Loading recipients... Recipients are populated by external
                      systems.
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3">
                  <div className="text-sm font-semibold text-neutral-100 mb-3">
                    Claim Your Payout
                  </div>
                  <ClaimButton
                    programId={dist.programId}
                    vaultSymbol={vaultSymbol}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
