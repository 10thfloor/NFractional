"use client";

import Link from "next/link";
import WalletButtons from "./WalletButtons";
import { usePlatformTreasuryBalance } from "@/hooks/usePlatformTreasury";
import { useUserFlowBalance } from "@/hooks/useUserFlowBalance";
import ClickSpark from "@/components/ClickSpark";

export default function Header() {
  const treasuryBalance = usePlatformTreasuryBalance();
  const { balance: flowBalance, address, loading } = useUserFlowBalance();

  const formatFlowBalance = (bal: string) => {
    const num = Number.parseFloat(bal || "0");
    if (num === 0) return "0";
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(4).replace(/\.?0+$/, "");
  };

  return (
    <header className="border-b">
      <ClickSpark
        sparkColor="#fff"
        sparkSize={10}
        sparkRadius={15}
        sparkCount={8}
        duration={400}
      >
        <div className="mx-auto max-w-6xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium">
              Vaults
            </Link>
            <Link href="/marketplace" className="text-sm font-medium">
              Listings
            </Link>
            <Link href="/pools" className="text-sm font-medium">
              Pools
            </Link>
            <div className="text-[11px] text-gray-600">
              Treasury: {treasuryBalance}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {address && (
              <div className="text-right leading-tight px-2">
                <div className="text-[11px] text-gray-400 font-mono">
                  {address}
                </div>
                <div className="text-[11px] text-gray-600">
                  {loading ? "..." : `${formatFlowBalance(flowBalance)} FLOW`}
                </div>
              </div>
            )}
            <Link
              href="/wizard/deposit"
              className="rounded border px-3 py-1.5 text-sm"
            >
              Fractionalize NFT
            </Link>
            <WalletButtons />
          </div>
        </div>
      </ClickSpark>
    </header>
  );
}
