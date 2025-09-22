"use client";
import { useEffect, useState } from "react";
import { getAmmFeeParams, type AmmFeeParams } from "@/lib/api/feesAmm";

export default function AmmFeesPanel({ vaultId }: { vaultId: string }) {
  const [params, setParams] = useState<AmmFeeParams>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getAmmFeeParams(vaultId);
        if (!cancelled) setParams(p);
      } finally {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  const feeBps = params?.feeBps ?? 50;
  const vaultSplit = params?.vaultSplitBps ?? 2000;
  const protocolSplit = params?.protocolSplitBps ?? 8000;

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">AMM Fees</div>
        <div className="text-[11px] text-neutral-400">Vault {vaultId}</div>
      </div>

      <div className="text-[11px] text-neutral-400 leading-relaxed">
        Used for AMM swaps. AMM fees are set by the platform.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 font-medium">Total Fee</div>
          <div className="text-xl font-semibold text-neutral-100">
            {(feeBps / 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-gray-500">{feeBps} bps</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 font-medium">
            Vault Split
          </div>
          <div className="text-sm font-medium text-neutral-200">
            {(vaultSplit / 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-gray-500">{vaultSplit} bps</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 font-medium">
            Protocol Split
          </div>
          <div className="text-sm font-medium text-neutral-200">
            {(protocolSplit / 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-gray-500">{protocolSplit} bps</div>
        </div>
      </div>

      <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-2">
        <div className="text-[11px] text-gray-500 mb-1 font-medium">
          Distribution
        </div>
        <div className="w-full h-2 rounded overflow-hidden border border-neutral-800 flex">
          <div
            className="bg-emerald-600 h-full"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, Number((vaultSplit / 100).toFixed(2)))
              )}%`,
            }}
            title={`Vault ${(vaultSplit / 100).toFixed(2)}%`}
          />
          <div
            className="bg-amber-500 h-full"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, Number((protocolSplit / 100).toFixed(2)))
              )}%`,
            }}
            title={`Protocol ${(protocolSplit / 100).toFixed(2)}%`}
          />
        </div>
      </div>
    </div>
  );
}
