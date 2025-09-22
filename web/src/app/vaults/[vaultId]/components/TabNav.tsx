"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabNav({ vaultId }: { vaultId: string }) {
  const pathname = usePathname();
  const base = `/vaults/${vaultId}`;
  const tabs = [
    { href: `${base}/overview`, label: "Activity" },
    { href: `${base}/liquidity`, label: "Manage Liquidity" },
    { href: `${base}/trade`, label: "Swap" },
    { href: `${base}/listings`, label: "Listings" },
    { href: `${base}/fees`, label: "Fees" },
    { href: `${base}/distributions`, label: "Distributions" },
    { href: `${base}/mint`, label: "Mint" },
  ];

  return (
    <div className="flex gap-2 border-b border-neutral-800 bg-neutral-950">
      {tabs.map((t) => {
        const active = pathname?.startsWith(t.href);
        const isBlueTab = t.label === "Manage Liquidity" || t.label === "Swap";
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              active
                ? isBlueTab
                  ? "px-3 py-2 text-sm rounded-t bg-blue-900/60 text-blue-100 border border-blue-900 border-b-transparent"
                  : "px-3 py-2 text-sm rounded-t bg-neutral-800 text-white border border-neutral-800 border-b-transparent"
                : isBlueTab
                ? "px-3 py-2 text-sm rounded-t text-blue-300 hover:text-blue-100"
                : "px-3 py-2 text-sm rounded-t text-neutral-400 hover:text-neutral-100"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
