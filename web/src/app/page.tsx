"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./components/AuthContext";
import HomePage from "./components/HomePage";
import VaultCard from "./components/VaultCard";
import { getVaults } from "@/lib/api/home";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function fetchVaults() {
  return await getVaults(50);
}

function VaultList() {
  const [vaults, setVaults] = useState<Awaited<ReturnType<typeof fetchVaults>>>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchVaults().then((v) => {
      if (!cancelled) {
        setVaults(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200">
        <div className="text-center py-12">Loading vaults...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Vaults</h1>
        <div className="text-xs text-neutral-400">
          Discover and trade vaults
        </div>
      </div>
      {vaults.length === 0 ? (
        <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-md">
          <div className="text-neutral-300 mb-2 text-lg font-medium">
            No vaults yet
          </div>
          <div className="text-neutral-500 text-sm mb-6 max-w-md mx-auto">
            Fractionalize your NFTs to create tradable shares. Start by
            depositing an NFT and setting up your vault.
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/wizard/deposit">Fractionalize Your NFT</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/marketplace">Explore Marketplace</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vaults.map((v) => (
            <li key={v.vaultId}>
              <VaultCard v={v} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function Home() {
  const { isLoggedIn, authenticate } = useAuth();

  // Show HomePage fullscreen when not logged in
  if (!isLoggedIn) {
    return <HomePage onConnect={authenticate} />;
  }

  // Show vault list when logged in
  return <VaultList />;
}
