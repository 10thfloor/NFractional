"use client";
import { Button } from "@/components/ui/button";

export default function PendingSchedule({
  pending,
  onActivate,
  activating,
}: {
  pending: {
    feeBps: number;
    vaultSplitBps: number;
    protocolSplitBps: number;
    effectiveAt: string;
  } | null;
  onActivate?: () => void;
  activating?: boolean;
}) {
  const feePct = pending ? (pending.feeBps / 100).toFixed(2) : null;
  const vaultPct = pending ? (pending.vaultSplitBps / 100).toFixed(2) : null;
  const protocolPct = pending
    ? (pending.protocolSplitBps / 100).toFixed(2)
    : null;
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pending Fee Schedule</h3>
      </div>
      {pending ? (
        <>
          <div className="text-xs text-amber-700 space-y-0.5 flex flex-col gap-1 w-2/3 border rounded p-3 mt-1 mb-1">
            <div title="1% = 100 bps">
              <span className="text-gray-500 mr-1">Total fee:</span>
              <span className="text-gray-100">{feePct}%</span> ({pending.feeBps}{" "}
              bps)
            </div>
            <div>
              <span className="text-gray-500 mr-1">Vault split:</span>
              <span className="text-gray-100">{vaultPct}%</span> (
              {pending.vaultSplitBps})
            </div>
            <div>
              <span className="text-gray-500 mr-1">Protocol split:</span>
              <span className="text-gray-100">{protocolPct}%</span> (
              {pending.protocolSplitBps})
            </div>
            <div>
              <span className="text-gray-500 mr-1">Effective at:</span>
              <span className="text-gray-100">
                {new Date(Number(pending.effectiveAt) * 1000).toLocaleString()}
              </span>{" "}
            </div>
          </div>
          {onActivate && (
            <div className="flex !justify-start">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={Boolean(activating)}
                onClick={onActivate}
              >
                {activating ? "Activating…" : "Activate"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-gray-400">No pending change</div>
      )}
    </div>
  );
}
