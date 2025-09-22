"use client";

export default function CurrentSchedule({
  feeBps,
  vaultSplitBps,
  protocolSplitBps,
}: {
  feeBps: number | null | undefined;
  vaultSplitBps: number | null | undefined;
  protocolSplitBps: number | null | undefined;
}) {
  // Platform defaults for AMM fees
  const defaultFeeBps = 50; // 0.5%
  const defaultVaultSplitBps = 2000; // 20%
  const defaultProtocolSplitBps = 8000; // 80%

  // Use custom fees if available, otherwise show platform defaults
  const activeFeeBps = typeof feeBps === "number" ? feeBps : defaultFeeBps;
  const activeVaultSplitBps =
    typeof vaultSplitBps === "number" ? vaultSplitBps : defaultVaultSplitBps;
  const activeProtocolSplitBps =
    typeof protocolSplitBps === "number"
      ? protocolSplitBps
      : defaultProtocolSplitBps;

  const feePct = (activeFeeBps / 100).toFixed(2);
  const vaultPct = (activeVaultSplitBps / 100).toFixed(2);
  const protocolPct = (activeProtocolSplitBps / 100).toFixed(2);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Active Fee Schedule</h3>
      </div>
      <div className="rounded border p-3">
        <div className="grid gap-1 text-xs">
          <div title="1% = 100 bps">
            <span className="text-gray-500 mr-1">Total fee:</span>
            <span className="text-gray-100">{feePct}%</span>
            <span className="text-gray-500 ml-1">({activeFeeBps} bps)</span>
          </div>
          <div>
            <span className="text-gray-500 mr-1">Vault split:</span>
            <span className="text-gray-100">{vaultPct}%</span>
            <span className="text-gray-500 ml-1">({activeVaultSplitBps})</span>
          </div>
          <div>
            <span className="text-gray-500 mr-1">Protocol split:</span>
            <span className="text-gray-100">{protocolPct}%</span>
            <span className="text-gray-500 ml-1">
              ({activeProtocolSplitBps})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
