"use client";
import Link from "next/link";

export default function NewVaultPage() {
  return (
    <main className="mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200">
      <h1 className="text-2xl font-semibold">Create a new vault</h1>
      <p className="text-sm text-gray-700">
        A vault ties your NFT to a per-vault share token (FT). Your NFT stays in
        your custody resource. Listings and fills move only the share tokens
        using Flow Actions; the platform tracks vault state and events.
      </p>
      <div className="grid grid-cols-1 gap-4">
        <Link className="underline" href="/vaults/new/wizard">
          Use the guided wizard
        </Link>
      </div>
    </main>
  );
}
