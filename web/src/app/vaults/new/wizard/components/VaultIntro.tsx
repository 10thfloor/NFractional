"use client";

export default function VaultIntro() {
  return (
    <div className="rounded border p-3 text-sm text-gray-700">
      <div className="font-medium mb-1">What is a Vault?</div>
      <p>
        A vault ties your NFT to a per-vault share token (FT). Your NFT stays in
        your custody resource. Listings and fills move only the share tokens
        using Flow Actions; the platform tracks vault state and events.
      </p>
    </div>
  );
}
